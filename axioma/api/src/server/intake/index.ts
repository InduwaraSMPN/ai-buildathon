import { ORPCError } from "@orpc/server";
import { and, eq, inArray, lt } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { forms, serviceSubcategories, ticketDrafts } from "@/db/schema";
import { env } from "@/env";
import type { IncidentDraftOutput } from "./schema";
import { removeOrphanedIntakeBlobs } from "./vision";

export type DraftRow = typeof ticketDrafts.$inferSelect;

export interface DraftSummary {
	id: string;
	status: "open" | "submitted" | "discarded";
	intent: "incident" | "catalogue_request" | "knowledge_answer" | null;
	transcript: Array<{
		role: "user" | "assistant";
		body: string;
		createdAt: Date;
	}>;
	values: Record<string, unknown>;
	fieldSources: Record<string, "ai" | "user">;
	aiDraft: Record<string, unknown> | null;
	subcategoryId: string | null;
	formId: string | null;
	ticketId: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export function toDraftSummary(row: DraftRow): DraftSummary {
	return {
		id: row.id,
		status: row.status as DraftSummary["status"],
		intent: row.intent as DraftSummary["intent"],
		transcript: (row.transcript ?? []) as DraftSummary["transcript"],
		values: (row.values ?? {}) as Record<string, unknown>,
		fieldSources: (row.fieldSources ?? {}) as Record<string, "ai" | "user">,
		aiDraft: (row.aiDraft ?? null) as Record<string, unknown> | null,
		subcategoryId: row.subcategoryId,
		formId: row.formId,
		ticketId: row.ticketId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

/**
 * Parses a model output, retrying once after stripping unknown keys. This
 * tolerates models that emit extra or renamed fields while still enforcing the
 * declared union/shape.
 */
export function repairDraftOutput<T>(raw: unknown, schema: z.ZodType<T>): T {
	try {
		return schema.parse(raw);
	} catch {
		if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
			const cleared = stripUnknownKeys(raw as Record<string, unknown>, schema);
			try {
				return schema.parse(cleared);
			} catch {
				throw new Error("Intake model output could not be parsed after repair");
			}
		}
		throw new Error("Intake model output could not be parsed");
	}
}

/**
 * Calls the model, and on a parse failure calls it once more (§9). A blind
 * re-issue of the same prompt tends to reproduce the same malformed output, so
 * the retry carries what went wrong.
 */
export async function draftWithRepair<T, R extends { content: string }>(
	call: (repairNote?: string) => Promise<R>,
	parse: (content: string) => T,
): Promise<{ parsed: T; result: R }> {
	try {
		const result = await call();
		return { parsed: parse(result.content), result };
	} catch (error) {
		const result = await call(
			`Your previous reply could not be parsed (${
				error instanceof Error ? error.message : "invalid output"
			}). Reply again with JSON matching the schema exactly. Use null for any value you cannot determine.`,
		);
		return { parsed: parse(result.content), result };
	}
}

function stripUnknownKeys(
	value: Record<string, unknown>,
	schema: z.ZodType<unknown>,
): Record<string, unknown> {
	if (!("shape" in schema)) return value;
	const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
	const result: Record<string, unknown> = {};
	for (const key of Object.keys(value)) {
		if (key in shape) result[key] = value[key];
	}
	return result;
}

/** Drops fields the model marked low-confidence by nulling their value. */
export function suppressLowConfidence(
	parsed: IncidentDraftOutput,
): IncidentDraftOutput {
	for (const key of DRAFTED_FIELD_KEYS) {
		const field = parsed[key];
		if (field && typeof field === "object" && "confidence" in field) {
			const entry = field as { confidence?: string; value?: unknown };
			if (entry.confidence === "low") entry.value = null;
		}
	}
	return parsed;
}

/** Returns the id only when it is present in the allowed catalogue set. */
export function whitelistSubcategory(
	subcategoryId: string | null,
	allowed: ReadonlySet<string>,
): string | null {
	if (!subcategoryId) return null;
	return allowed.has(subcategoryId) ? subcategoryId : null;
}

/**
 * Drops model-invented keys. `writeDynamicFieldValues` and
 * `validateFormSubmission` both throw on an unknown key from inside the submit
 * transaction, which would leave a draft that can never be submitted.
 */
export function whitelistKeys(
	entries: Record<string, unknown>,
	allowed: ReadonlySet<string>,
): Record<string, unknown> {
	const kept: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(entries))
		if (allowed.has(key)) kept[key] = value;
	return kept;
}

const DRAFTED_FIELD_KEYS = [
	"title",
	"body",
	"impact",
	"urgency",
	"deviceId",
	"customFields",
] as const;

export async function startDraft(reporterId: string): Promise<DraftSummary> {
	const row = (
		await db
			.insert(ticketDrafts)
			.values({
				id: crypto.randomUUID(),
				reporterId,
				status: "open",
				transcript: [],
				values: {},
				fieldSources: {},
			})
			.returning()
	)[0];
	if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
	return toDraftSummary(row);
}

/**
 * Loads an owned draft in any status. §3.5 retains the row after submit, so a
 * read-back has to survive the status flip; only mutations require `open`.
 */
export async function readDraft(
	draftId: string,
	reporterId: string,
): Promise<DraftRow> {
	const row = (
		await db
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
	if (!row) throw new ORPCError("NOT_FOUND");
	return row;
}

/** Loads an open draft owned by the reporter, else NOT_FOUND. */
export async function loadDraft(
	draftId: string,
	reporterId: string,
): Promise<DraftRow> {
	const row = await readDraft(draftId, reporterId);
	if (row.status !== "open") throw new ORPCError("NOT_FOUND");
	return row;
}

/** Appends a transcript entry to an owned open draft. */
export async function appendMessage(
	draftId: string,
	reporterId: string,
	role: "user" | "assistant",
	body: string,
): Promise<void> {
	const draft = await loadDraft(draftId, reporterId);
	const transcript = [
		...((draft.transcript as Array<{
			role: "user" | "assistant";
			body: string;
			createdAt: Date;
		}> | null) ?? []),
	];
	transcript.push({ role, body, createdAt: new Date() });
	await db
		.update(ticketDrafts)
		.set({ transcript, updatedAt: new Date() })
		.where(eq(ticketDrafts.id, draftId));
}

/**
 * Folds a user edit into the stored draft. Every supplied key is written, so
 * `values` holds the effective post-edit values §3.5 diffs against; only the
 * provenance label is guarded, because an `ai` label must never demote a field
 * the employee has already corrected.
 */
export function mergeDraftPatch(
	current: {
		values: Record<string, unknown>;
		sources: Record<string, "ai" | "user">;
	},
	patch: {
		values: Record<string, unknown>;
		sources: Record<string, "ai" | "user">;
	},
): {
	values: Record<string, unknown>;
	sources: Record<string, "ai" | "user">;
} {
	const values = { ...current.values };
	const sources = { ...current.sources };
	const label = (key: string, source: "ai" | "user") => {
		if (source === "ai" && sources[key] === "user") return;
		sources[key] = source;
	};
	for (const [key, value] of Object.entries(patch.values)) {
		values[key] = value;
		// This is the user-edit endpoint, so an unlabelled key is an employee
		// correction and is recorded as one.
		label(key, patch.sources[key] ?? "user");
	}
	for (const [key, source] of Object.entries(patch.sources))
		if (!(key in patch.values)) label(key, source);
	return { values, sources };
}

const asId = (value: unknown): string | null =>
	typeof value === "string" && value ? value : null;

/** Applies a user edit to an owned open draft. */
export async function patchDraft(
	draftId: string,
	reporterId: string,
	values: Record<string, unknown>,
	sources: Record<string, "ai" | "user">,
): Promise<DraftSummary> {
	const draft = await loadDraft(draftId, reporterId);
	const merged = mergeDraftPatch(
		{
			values: (draft.values ?? {}) as Record<string, unknown>,
			sources: (draft.fieldSources ?? {}) as Record<string, "ai" | "user">,
		},
		{ values, sources },
	);
	// The §3.5 correction diff reads the columns, so they cannot be allowed to
	// drift from the values they mirror.
	const subcategoryId = asId(merged.values.subcategoryId);
	const formId = asId(merged.values.formId);
	await assertRoutingExists(
		subcategoryId === draft.subcategoryId ? null : subcategoryId,
		formId === draft.formId ? null : formId,
	);
	const row = (
		await db
			.update(ticketDrafts)
			.set({
				values: merged.values,
				fieldSources: merged.sources,
				subcategoryId,
				formId,
				updatedAt: new Date(),
			})
			.where(eq(ticketDrafts.id, draftId))
			.returning()
	)[0];
	if (!row) throw new ORPCError("NOT_FOUND");
	return toDraftSummary(row);
}

/** The columns carry foreign keys, so an invented id has to fail as a request error. */
async function assertRoutingExists(
	subcategoryId: string | null,
	formId: string | null,
): Promise<void> {
	if (subcategoryId) {
		const [found] = await db
			.select({ id: serviceSubcategories.id })
			.from(serviceSubcategories)
			.where(eq(serviceSubcategories.id, subcategoryId))
			.limit(1);
		if (!found)
			throw new ORPCError("BAD_REQUEST", {
				message: `Unknown request subcategory ${subcategoryId}`,
			});
	}
	if (formId) {
		const [found] = await db
			.select({ id: forms.id })
			.from(forms)
			.where(eq(forms.id, formId))
			.limit(1);
		if (!found)
			throw new ORPCError("BAD_REQUEST", {
				message: `Unknown form ${formId}`,
			});
	}
}

/** Discards an owned draft, clearing its status without deleting links immediately. */
export async function discardDraft(
	draftId: string,
	reporterId: string,
): Promise<{ deleted: boolean }> {
	await loadDraft(draftId, reporterId);
	const row = (
		await db
			.update(ticketDrafts)
			.set({ status: "discarded", updatedAt: new Date() })
			.where(eq(ticketDrafts.id, draftId))
			.returning({ id: ticketDrafts.id })
	)[0];
	await removeOrphanedIntakeBlobs([draftId]);
	return { deleted: Boolean(row) };
}

const SWEPT_STATUSES = ["open", "discarded"] as const;

/** Deletes abandoned and discarded drafts older than the TTL, links first. */
export async function sweepIntakeDrafts(): Promise<{ deleted: number }> {
	const cutoff = new Date(
		Date.now() - env.AXIOMA_INTAKE_DRAFT_TTL_HOURS * 60 * 60_000,
	);
	const expired = and(
		inArray(ticketDrafts.status, [...SWEPT_STATUSES]),
		lt(ticketDrafts.updatedAt, cutoff),
	);
	const stale = await db
		.select({ id: ticketDrafts.id })
		.from(ticketDrafts)
		.where(expired);
	if (!stale.length) return { deleted: 0 };
	const ids = stale.map((row) => row.id);
	// Links go first: `document_links.target_id` is plain text with no foreign
	// key, so a crash after the draft rows were deleted would strand rows that
	// nothing can reach.
	await removeOrphanedIntakeBlobs(ids);
	const deleted = await db
		.delete(ticketDrafts)
		.where(
			and(
				inArray(ticketDrafts.status, [...SWEPT_STATUSES]),
				inArray(ticketDrafts.id, ids),
			),
		)
		.returning({ id: ticketDrafts.id });
	return { deleted: deleted.length };
}
