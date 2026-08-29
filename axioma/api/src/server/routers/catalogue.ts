import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	approvals,
	formFields,
	formSubmissions,
	forms,
	serviceFamilies,
	serviceSubcategories,
	services,
	user,
} from "@/db/schema";
import { validateFormSubmission } from "../forms";
import {
	anyCapabilityProcedure,
	capabilityProcedure,
	reporterProcedure,
} from "../orpc";
import {
	createTicketInTransaction,
	finalizeCreatedTicket,
} from "../tickets/create";

async function getForm(id: string) {
	const form = (
		await db.select().from(forms).where(eq(forms.id, id)).limit(1)
	)[0];
	if (!form) throw new ORPCError("NOT_FOUND");
	return {
		...form,
		fields: await db
			.select()
			.from(formFields)
			.where(eq(formFields.formId, id))
			.orderBy(asc(formFields.ordinal)),
	};
}

export const catalogueRouter = {
	listForms: capabilityProcedure("catalogue.manage").listForms.handler(
		async () => {
			const rows = await db.select().from(forms).orderBy(desc(forms.updatedAt));
			return Promise.all(rows.map((form) => getForm(form.id)));
		},
	),
	createForm: capabilityProcedure("catalogue.manage").createForm.handler(
		async ({ context, input }) => {
			const id = crypto.randomUUID();
			await db.transaction(async (tx) => {
				await tx.insert(forms).values({
					id,
					key: input.key,
					version: 1,
					name: input.name,
					description: input.description ?? null,
					createdById: context.userId,
				});
				if (input.fields.length)
					await tx.insert(formFields).values(
						input.fields.map((field, ordinal) => ({
							id: crypto.randomUUID(),
							formId: id,
							ordinal,
							...field,
						})),
					);
			});
			return getForm(id);
		},
	),
	updateForm: capabilityProcedure("catalogue.manage").updateForm.handler(
		async ({ input }) => {
			await db.transaction(async (tx) => {
				const current = (
					await tx.select().from(forms).where(eq(forms.id, input.id)).limit(1)
				)[0];
				if (current?.status !== "draft")
					throw new ORPCError("CONFLICT", {
						message: "Only draft forms can be edited",
					});
				await tx
					.update(forms)
					.set({
						key: input.key,
						name: input.name,
						description: input.description ?? null,
						updatedAt: new Date(),
					})
					.where(eq(forms.id, input.id));
				await tx.delete(formFields).where(eq(formFields.formId, input.id));
				if (input.fields.length)
					await tx.insert(formFields).values(
						input.fields.map((field, ordinal) => ({
							id: crypto.randomUUID(),
							formId: input.id,
							ordinal,
							...field,
						})),
					);
			});
			return getForm(input.id);
		},
	),
	publishForm: capabilityProcedure("catalogue.manage").publishForm.handler(
		async ({ input }) => {
			const fields = await db
				.select()
				.from(formFields)
				.where(eq(formFields.formId, input.id));
			if (!fields.length)
				throw new ORPCError("BAD_REQUEST", {
					message: "A form needs at least one field",
				});
			await db
				.update(forms)
				.set({
					status: "published",
					publishedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(and(eq(forms.id, input.id), eq(forms.status, "draft")));
			return getForm(input.id);
		},
	),
	listCatalogue: anyCapabilityProcedure(
		"catalogue.manage",
		"ticket.reclassify",
	).listCatalogue.handler(async () => {
		const [families, serviceRows, subcategories] = await Promise.all([
			db.select().from(serviceFamilies).orderBy(serviceFamilies.name),
			db.select().from(services).orderBy(services.name),
			db.select().from(serviceSubcategories).orderBy(serviceSubcategories.name),
		]);
		return { families, services: serviceRows, subcategories };
	}),
	listRequestCatalogue: capabilityProcedure(
		"ticket.create",
	).listRequestCatalogue.handler(async () => {
		const rows = await db
			.select({ subcategory: serviceSubcategories, form: forms })
			.from(serviceSubcategories)
			.innerJoin(services, eq(serviceSubcategories.serviceId, services.id))
			.innerJoin(serviceFamilies, eq(services.familyId, serviceFamilies.id))
			.leftJoin(
				forms,
				and(
					eq(serviceSubcategories.formId, forms.id),
					eq(forms.status, "published"),
				),
			)
			.where(
				and(
					eq(serviceSubcategories.isActive, true),
					eq(services.isActive, true),
					eq(serviceFamilies.isActive, true),
					sql`${serviceSubcategories.formId} is null or ${forms.id} is not null`,
				),
			)
			.orderBy(serviceSubcategories.name);
		return Promise.all(
			rows.map(async ({ subcategory, form }) => ({
				subcategory,
				form: form
					? {
							...form,
							fields: await db
								.select()
								.from(formFields)
								.where(eq(formFields.formId, form.id))
								.orderBy(asc(formFields.ordinal)),
						}
					: null,
			})),
		);
	}),
	createCatalogueRequest: capabilityProcedure(
		"ticket.create",
	).createCatalogueRequest.handler(async ({ context, input }) => {
		const result = await db.transaction(async (tx) => {
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
							eq(forms.id, input.formId),
							eq(forms.id, serviceSubcategories.formId),
							eq(forms.status, "published"),
						),
					)
					.innerJoin(user, eq(user.id, context.userId))
					.where(
						and(
							eq(serviceSubcategories.id, input.subcategoryId),
							eq(serviceSubcategories.isActive, true),
							eq(services.isActive, true),
							eq(serviceFamilies.isActive, true),
						),
					)
					.limit(1)
			)[0];
			if (!selected)
				throw new ORPCError("NOT_FOUND", {
					message: "Published request form not found",
				});
			const fields = await tx
				.select()
				.from(formFields)
				.where(eq(formFields.formId, selected.form.id))
				.orderBy(asc(formFields.ordinal));
			let values: Record<string, unknown>;
			try {
				values = validateFormSubmission(fields, input.values);
			} catch (error) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						error instanceof Error ? error.message : "Invalid form submission",
				});
			}
			const submissionId = crypto.randomUUID();
			const created = await createTicketInTransaction(tx, {
				source: "catalogue",
				reporterId: context.userId,
				title: input.title,
				body: input.body,
				recordType: "service_request",
				serviceId: selected.subcategory.serviceId,
				serviceSubcategoryId: selected.subcategory.id,
			});
			const ticketId = created.ticketId;
			/* numbering is owned by createTicketInTransaction */
			await tx.insert(formSubmissions).values({
				id: submissionId,
				formId: selected.form.id,
				submitterId: context.userId,
				ticketId,
				values,
			});
			const approverId =
				selected.subcategory.approverOverrideId ?? selected.managerId;
			if (!approverId)
				throw new ORPCError("CONFLICT", {
					message: "This request needs an approver, but none is configured",
				});
			let approval = null;
			if (approverId) {
				approval =
					(
						await tx
							.insert(approvals)
							.values({
								id: crypto.randomUUID(),
								requesterId: context.userId,
								approverId,
								ticketId,
								submissionId,
							})
							.returning()
					)[0] ?? null;
				if (!approval) throw new ORPCError("INTERNAL_SERVER_ERROR");
			}
			return { ticketId, approval, created };
		});
		await finalizeCreatedTicket(result.created, { reporterId: context.userId });
		return result;
	}),
	listApprovals: capabilityProcedure("approval.read").listApprovals.handler(
		({ context }) =>
			db
				.select()
				.from(approvals)
				.where(eq(approvals.approverId, context.userId))
				.orderBy(desc(approvals.requestedAt)),
	),
	decideApproval: capabilityProcedure("approval.decide").decideApproval.handler(
		async ({ context, input }) => {
			const row = (
				await db
					.update(approvals)
					.set({
						status: input.decision,
						decisionNote: input.note,
						decidedAt: new Date(),
					})
					.where(
						and(
							eq(approvals.id, input.id),
							eq(approvals.approverId, context.userId),
							eq(approvals.status, "waiting_for_approval"),
						),
					)
					.returning()
			)[0];
			if (!row)
				throw new ORPCError("CONFLICT", {
					message:
						"Approval is missing, already decided, or belongs to another approver",
				});
			return row;
		},
	),
	getMyApprovalStatus: reporterProcedure.getMyApprovalStatus.handler(
		async ({ context, input }) => {
			return (
				(
					await db
						.select({
							status: approvals.status,
							requestedAt: approvals.requestedAt,
							decidedAt: approvals.decidedAt,
						})
						.from(approvals)
						.where(
							and(
								eq(approvals.ticketId, input.ticketId),
								eq(approvals.requesterId, context.userId),
							),
						)
						.limit(1)
				)[0] ?? null
			);
		},
	),
};
