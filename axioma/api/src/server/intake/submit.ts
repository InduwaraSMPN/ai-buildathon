import { ORPCError } from "@orpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
	approvals,
	documentLinks,
	formFields,
	formSubmissions,
	forms,
	serviceFamilies,
	serviceSubcategories,
	services,
	ticketDrafts,
	ticketMessages,
	user,
} from "@/db/schema";
import { IMPACT_LEVELS, URGENCY_LEVELS } from "@/shared";
import { validateFormSubmission } from "../forms";
import {
	type CreatedTicket,
	createTicketInTransaction,
	finalizeCreatedTicket,
} from "../tickets/create";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface SubmitResult {
	ticketId: string;
	approval: { id: string } | null;
}

function formatTranscript(
	transcript: ReadonlyArray<{ role: string; body: string }>,
): string {
	return transcript
		.map(
			({ role, body }) =>
				`${role === "user" ? "Employee" : "Assistant"}: ${body}`,
		)
		.join("\n");
}

// The manual path's bounds from `contracts/tickets.ts`. A drafted ticket has to
// clear the same bar, and it has to clear it before anything is inserted.
//
// The levels and the two records are parsed rather than cast because everything
// below this line runs inside the submit transaction, where a bad value is no
// longer a request error: `derivePriority` indexes a literal object, so an
// out-of-enum level threw a TypeError the caller saw as a 500, and the form and
// dynamic-field writers throw plain Errors on a value that is not a record.
const draftTicketText = z.object({
	title: z.string().trim().min(3).max(160),
	body: z.string().trim().min(10).max(10_000),
	impact: z.enum(IMPACT_LEVELS).optional(),
	urgency: z.enum(URGENCY_LEVELS).optional(),
	formValues: z.record(z.string(), z.unknown()).optional(),
	customFields: z.record(z.string(), z.unknown()).optional(),
});

/**
 * §3.3's anti-rubber-stamping gate. The routing decision is the single
 * highest-stakes field, so when the *model* chose the subcategory the employee
 * has to have confirmed it before anything is created. A subcategory the
 * employee picked themselves is already a deliberate act and needs no second
 * one. This lived only in the client until now, which meant a direct
 * `submitIntakeDraft` call routed an unreviewed AI guess.
 */
export function requireSubcategoryConfirmed(
	values: Record<string, unknown> | null,
	sources: Record<string, unknown> | null,
): void {
	const subcategoryId = values?.subcategoryId;
	if (typeof subcategoryId !== "string" || !subcategoryId) return;
	if (sources?.subcategoryId !== "ai") return;
	if (values?.subcategoryConfirmed === true) return;
	throw new ORPCError("BAD_REQUEST", {
		message:
			"Draft cannot be submitted: confirm the request type the assistant chose before sending.",
	});
}

export function validateDraftText(
	values: Record<string, unknown> | null,
): z.infer<typeof draftTicketText> {
	const parsed = draftTicketText.safeParse({
		title: values?.title,
		body: values?.body,
		impact: values?.impact ?? undefined,
		urgency: values?.urgency ?? undefined,
		formValues: values?.formValues ?? undefined,
		customFields: values?.customFields ?? undefined,
	});
	if (!parsed.success)
		throw new ORPCError("BAD_REQUEST", {
			message: `Draft cannot be submitted: ${parsed.error.issues
				.map((issue) => `${issue.path.join(".") || "value"} ${issue.message}`)
				.join("; ")}`,
		});
	return parsed.data;
}

export async function submitIntake(
	draftId: string,
	reporterId: string,
	idempotencyKey: string,
): Promise<SubmitResult> {
	const result = await db.transaction(async (tx) => {
		// The status check and the flip are one statement, so a concurrent submit
		// blocks on the row and then matches nothing — it can no longer reach the
		// transcript insert and duplicate it on the ticket the winner created.
		const claimed = (
			await tx
				.update(ticketDrafts)
				.set({ status: "submitted", updatedAt: new Date() })
				.where(
					and(
						eq(ticketDrafts.id, draftId),
						eq(ticketDrafts.reporterId, reporterId),
						eq(ticketDrafts.status, "open"),
					),
				)
				.returning()
		)[0];
		if (!claimed) return settledSubmit(tx, draftId, reporterId);

		const values = (claimed.values ?? {}) as Record<string, unknown>;
		const draft = validateDraftText(values);
		requireSubcategoryConfirmed(
			values,
			(claimed.fieldSources ?? {}) as Record<string, unknown>,
		);
		const subcategoryId =
			typeof values.subcategoryId === "string" && values.subcategoryId
				? values.subcategoryId
				: null;

		const [created, catalogueApproval] = subcategoryId
			? await createCatalogueTicket(tx, {
					subcategoryId,
					formId: typeof values.formId === "string" ? values.formId : null,
					formValues: draft.formValues ?? {},
					reporterId,
					title: draft.title,
					body: draft.body,
					idempotencyKey,
				})
			: [
					await createTicketInTransaction(tx, {
						source: "portal",
						idempotencyKey,
						reporterId,
						title: draft.title,
						body: draft.body,
						recordType: "incident",
						impact: draft.impact,
						urgency: draft.urgency,
						deviceId:
							typeof values.deviceId === "string" ? values.deviceId : null,
						customFields: draft.customFields,
					}),
					null as { id: string } | null,
				];

		const ticketId = created.ticketId;
		await reparentDraftDocuments(tx, draftId, ticketId);
		// Only the run that actually created the ticket writes the transcript; an
		// idempotent replay must not append a second copy to the same ticket.
		if (created.created)
			await tx.insert(ticketMessages).values({
				id: crypto.randomUUID(),
				ticketId,
				authorId: reporterId,
				authorType: "reporter",
				body: formatTranscript(
					Array.isArray(claimed.transcript)
						? (claimed.transcript as { role: string; body: string }[])
						: [],
				),
				visibility: "public",
			});
		await tx
			.update(ticketDrafts)
			.set({ ticketId, updatedAt: new Date() })
			.where(eq(ticketDrafts.id, draftId));

		return { created, ticketId, approval: catalogueApproval };
	});

	if (result.created?.created)
		void finalizeCreatedTicket(result.created, { reporterId });
	return {
		ticketId: result.ticketId,
		approval: result.approval ?? null,
	};
}

/**
 * Reached when the claim matched nothing. A draft already submitted returns its
 * ticket so a retry is idempotent; anything else is a state the caller cannot
 * submit from.
 */
async function settledSubmit(
	tx: Transaction,
	draftId: string,
	reporterId: string,
): Promise<{
	created: CreatedTicket | null;
	ticketId: string;
	approval: { id: string } | null;
}> {
	const existing = (
		await tx
			.select()
			.from(ticketDrafts)
			.where(
				and(
					eq(ticketDrafts.id, draftId),
					eq(ticketDrafts.reporterId, reporterId),
				),
			)
			.limit(1)
	)[0];
	if (!existing) throw new ORPCError("NOT_FOUND");
	if (existing.status !== "submitted" || !existing.ticketId)
		throw new ORPCError("CONFLICT", {
			message: "Draft is no longer open for submission",
		});
	const [approval] = await tx
		.select({ id: approvals.id })
		.from(approvals)
		.where(eq(approvals.ticketId, existing.ticketId))
		.limit(1);
	return {
		created: null,
		ticketId: existing.ticketId,
		approval: approval ?? null,
	};
}

/**
 * Moves the draft's attachments onto the ticket. A document already linked to
 * that ticket would collide with `document_links_target_uidx` and fail the
 * whole submit, so the redundant draft link is dropped rather than moved.
 */
async function reparentDraftDocuments(
	tx: Transaction,
	draftId: string,
	ticketId: string,
): Promise<void> {
	const draftLinks = and(
		eq(documentLinks.targetType, "draft"),
		eq(documentLinks.targetId, draftId),
	);
	await tx
		.delete(documentLinks)
		.where(
			and(
				draftLinks,
				sql`exists (select 1 from document_links existing where existing.document_id = ${documentLinks.documentId} and existing.target_type = 'ticket' and existing.target_id = ${ticketId})`,
			),
		);
	await tx
		.update(documentLinks)
		.set({ targetType: "ticket", targetId: ticketId })
		.where(draftLinks);
}

async function createCatalogueTicket(
	tx: Transaction,
	input: {
		subcategoryId: string;
		formId: string | null;
		formValues: Record<string, unknown>;
		reporterId: string;
		title: string;
		body: string;
		idempotencyKey: string;
	},
): Promise<[CreatedTicket, { id: string } | null]> {
	const selected = (
		await tx
			.select({
				subcategory: serviceSubcategories,
				form: forms,
				managerId: user.managerId,
			})
			.from(serviceSubcategories)
			.innerJoin(services, eq(serviceSubcategories.serviceId, services.id))
			.innerJoin(serviceFamilies, eq(services.familyId, serviceFamilies.id))
			.innerJoin(
				forms,
				and(
					eq(serviceSubcategories.formId, forms.id),
					eq(forms.status, "published"),
				),
			)
			.innerJoin(user, eq(user.id, input.reporterId))
			.where(
				and(
					eq(serviceSubcategories.id, input.subcategoryId),
					eq(serviceSubcategories.isActive, true),
					eq(services.isActive, true),
					eq(serviceFamilies.isActive, true),
					input.formId ? eq(forms.id, input.formId) : undefined,
				),
			)
			.limit(1)
	)[0];
	if (!selected)
		throw new ORPCError("NOT_FOUND", {
			message: "Published request subcategory not found",
		});

	let formValues: Record<string, unknown> = {};
	if (selected.form) {
		const fields = await tx
			.select()
			.from(formFields)
			.where(eq(formFields.formId, selected.form.id))
			.orderBy(asc(formFields.ordinal));
		try {
			formValues = validateFormSubmission(fields, input.formValues);
		} catch (error) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					error instanceof Error ? error.message : "Invalid form submission",
			});
		}
	}

	const created = await createTicketInTransaction(tx, {
		source: "catalogue",
		idempotencyKey: input.idempotencyKey,
		reporterId: input.reporterId,
		title: input.title,
		body: input.body,
		recordType: "service_request",
		serviceId: selected.subcategory.serviceId,
		serviceSubcategoryId: selected.subcategory.id,
	});
	if (!created.created) {
		const [approval] = await tx
			.select()
			.from(approvals)
			.where(eq(approvals.ticketId, created.ticketId))
			.limit(1);
		return [created, approval ? { id: approval.id } : null];
	}

	let submissionId: string | null = null;
	if (Object.keys(formValues).length) {
		submissionId = crypto.randomUUID();
		await tx.insert(formSubmissions).values({
			id: submissionId,
			formId: selected.form.id,
			submitterId: input.reporterId,
			ticketId: created.ticketId,
			values: formValues,
		});
	}

	const approverId =
		selected.subcategory.approverOverrideId ?? selected.managerId;
	let approval: { id: string } | null = null;
	if (approverId) {
		const row = (
			await tx
				.insert(approvals)
				.values({
					id: crypto.randomUUID(),
					requesterId: input.reporterId,
					approverId,
					ticketId: created.ticketId,
					submissionId,
				})
				.returning({ id: approvals.id })
		)[0];
		approval = row ?? null;
		if (!approval) throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return [created, approval];
}
