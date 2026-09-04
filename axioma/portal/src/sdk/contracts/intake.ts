// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

// `eventIterator` is the only iterator helper @orpc/contract 1.15.0 exports.
// `asyncIteratorObject` is its name on oRPC's main branch, not here — importing
// it under that alias reads as though the unreleased name were the current one.
import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";
import { URGENCY_LEVELS } from "../shared";
import { id, impact, jsonRecord } from "./shared";

export const drafted = <T extends z.ZodTypeAny>(inner: T) =>
	z.object({
		value: inner.nullable(),
		confidence: z.enum(["high", "low"]),
		reason: z.string().nullable(),
	});

export const intakeTranscriptEntry = z.object({
	role: z.enum(["user", "assistant"]),
	body: z.string(),
	// The transcript lives in a jsonb column, so a Date written here reads back
	// as an ISO string. z.date() would reject it and fail output validation on
	// every event once the transcript is non-empty, which is from the first turn.
	createdAt: z.coerce.date(),
});

export const intakeStatus = z.enum(["open", "submitted", "discarded"]);

/**
 * The closed set of keys a draft legitimately carries. This was an open record,
 * which meant any holder of `ticket.create` could write whatever they liked
 * onto their own draft — `deviceId` included, and `tickets.device_id` is the
 * sole authorization anchor for every device tool call, so a borrowed id had
 * the agent acting on somebody else's laptop. Ownership is still re-checked
 * server-side; this only stops anything the draft does not own from being
 * stored in the first place.
 */
export const patchableDraftValues = z.strictObject({
	title: z.string().max(160).optional(),
	body: z.string().max(10_000).optional(),
	impact: impact.optional(),
	urgency: z.enum(URGENCY_LEVELS).optional(),
	deviceId: id.optional(),
	subcategoryId: id.optional(),
	subcategoryConfirmed: z.boolean().optional(),
	formId: id.optional(),
	formValues: jsonRecord.optional(),
	customFields: jsonRecord.optional(),
});

export const draftSummary = z.object({
	id: z.string(),
	status: intakeStatus,
	intent: z
		.enum(["incident", "catalogue_request", "knowledge_answer"])
		.nullable(),
	transcript: z.array(intakeTranscriptEntry),
	values: z.record(z.string(), z.unknown()),
	fieldSources: z.record(z.string(), z.enum(["ai", "user"])),
	aiDraft: z.record(z.string(), z.unknown()).nullable(),
	subcategoryId: z.string().nullable(),
	formId: z.string().nullable(),
	ticketId: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const intakeEvent = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("status"),
		stage: z.enum([
			"retrieving",
			"reading_attachments",
			"drafting",
			"classifying",
		]),
	}),
	z.object({ type: z.literal("message"), delta: z.string() }),
	z.object({
		type: z.literal("deflection"),
		articles: z.array(
			z.object({
				id: z.string(),
				title: z.string(),
				summary: z.string().nullable(),
			}),
		),
	}),
	z.object({
		type: z.literal("field"),
		path: z.string(),
		value: z.unknown(),
		confidence: z.enum(["high", "low"]),
	}),
	z.object({ type: z.literal("complete"), draft: draftSummary }),
	z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
]);

export const intakeContract = {
	startIntakeDraft: oc.output(draftSummary),
	sendIntakeMessage: oc
		.input(
			z.object({
				draftId: id,
				body: z.string().trim().min(1).max(10_000),
				excludedAttachments: z.array(z.string()).optional(),
			}),
		)
		.output(eventIterator(intakeEvent)),
	getIntakeDraft: oc
		.input(z.object({ draftId: id }))
		.output(draftSummary.nullable()),
	patchIntakeDraft: oc
		.input(
			z.object({
				draftId: id,
				values: patchableDraftValues,
				// Left open: a source is only a provenance label, and the client
				// records one for nested paths the value schema does not name.
				sources: z.record(z.string(), z.enum(["ai", "user"])),
			}),
		)
		.output(draftSummary),
	submitIntakeDraft: oc
		.input(z.object({ draftId: id, idempotencyKey: z.uuid() }))
		.output(
			z.object({
				ticketId: z.string(),
				approval: z.object({ id: z.string() }).nullable(),
			}),
		),
	discardIntakeDraft: oc
		.input(z.object({ draftId: id }))
		.output(z.object({ deleted: z.boolean() })),
	intakeCapabilities: oc.output(
		z.object({ enabled: z.boolean(), vision: z.boolean() }),
	),
};
