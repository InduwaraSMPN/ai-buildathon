import type { z } from "zod";
import type { draftSummary, intakeEvent } from "@/sdk/contracts/intake";

export type IntakeEvent = z.infer<typeof intakeEvent>;
export type Draft = z.infer<typeof draftSummary>;
export type DraftFieldSource = "ai" | "user";
export type DraftIntent = NonNullable<Draft["intent"]>;

export type FieldDraft = {
	value: unknown;
	confidence: "high" | "low";
	reason: string | null;
};

export type Impact = "high" | "medium" | "low";
export type Urgency = "high" | "medium" | "low";

/**
 * The draft's working values. Deliberately not `IncidentValues` from
 * `features/tickets/form-schema`: that one is `z.input<typeof incidentSchema>`,
 * the fully-answered shape the manual form submits, while a draft holds a
 * partially-filled one the model may still be filling in.
 */
export type IntakeDraftValues = {
	title: string;
	body: string;
	impact?: Impact;
	urgency?: Urgency;
	deviceId?: string;
	customFields: Record<string, unknown>;
	subcategoryId?: string;
	formId?: string;
	formValues?: Record<string, unknown>;
};

export type SuggestionChip = { label: string; hint?: string };

/**
 * Lives above the composer so it survives the compose → triage remount: the
 * documents stay linked to the draft server-side, so a tray that reset would
 * silently re-enable reading of a screenshot the user had opted out of.
 */
export type DraftAttachment = {
	key: string;
	id: string;
	name: string;
	kind: "image" | "file";
	status: "uploading" | "done" | "error";
	/** §3.7 per-attachment vision opt-out; false excludes it from the model call. */
	read: boolean;
};

export type IntakeStage = "compose" | "triage" | "review";

export type TranscriptEntry = {
	role: "user" | "assistant";
	body: string;
	createdAt: Date;
};

export type DraftViewState = {
	draftId: string | null;
	stage: IntakeStage;
	transcript: TranscriptEntry[];
	streaming: boolean;
	busyStage:
		| "retrieving"
		| "reading_attachments"
		| "drafting"
		| "classifying"
		| null;
	assistantMessage: string;
	articles: Array<{ id: string; title: string; summary: string | null }>;
	values: IntakeDraftValues;
	fieldSources: Record<string, DraftFieldSource>;
	aiDraft: Record<string, FieldDraft> | null;
	intent: DraftIntent | null;
	subcategoryId: string | null;
	formId: string | null;
	ticketId: string | null;
	status: Draft["status"];
	ready: boolean;
	subcategoryConfirmed: boolean;
	error: { code: string; message: string } | null;
};
