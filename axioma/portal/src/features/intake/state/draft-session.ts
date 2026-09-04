import type { DraftAttachment } from "@/features/intake/types";

const DRAFT_ID_KEY = "intake_draft_id";
const READ_FLAGS_KEY = "intake_draft_attachment_reads";

/**
 * The draft id and the per-attachment vision opt-out (§3.7) both survive a
 * reload here. The documents themselves come back from `listDocuments`, but the
 * `read` flag is client-only state the server never stores, so it is kept
 * beside the id and keyed by document id.
 */
function storage(): Storage | null {
	try {
		return typeof window === "undefined" ? null : window.sessionStorage;
	} catch {
		return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readSavedDraftId(): string | null {
	try {
		return storage()?.getItem(DRAFT_ID_KEY) ?? null;
	} catch {
		return null;
	}
}

export function saveDraftId(draftId: string): void {
	try {
		storage()?.setItem(DRAFT_ID_KEY, draftId);
	} catch {
		// A full or blocked store just means this draft is not recoverable.
	}
}

export function clearSavedDraft(): void {
	try {
		const store = storage();
		store?.removeItem(DRAFT_ID_KEY);
		store?.removeItem(READ_FLAGS_KEY);
	} catch {
		// ignore storage errors
	}
}

/** Records which of the draft's documents the user has allowed Axel to read. */
export function saveReadFlags(
	draftId: string,
	attachments: DraftAttachment[],
): void {
	const read: Record<string, boolean> = {};
	for (const entry of attachments) if (entry.id) read[entry.id] = entry.read;
	try {
		storage()?.setItem(READ_FLAGS_KEY, JSON.stringify({ draftId, read }));
	} catch {
		// ignore storage errors
	}
}

/**
 * Drops one document's stored choice, for use once the server has confirmed the
 * document is unlinked. Without it a removed id lingered in the record, and a
 * new document that happened to reuse the id would inherit a stale opt-in.
 */
export function forgetReadFlag(draftId: string, documentId: string): void {
	const flags = readSavedReadFlags(draftId);
	if (!(documentId in flags)) return;
	delete flags[documentId];
	try {
		storage()?.setItem(
			READ_FLAGS_KEY,
			JSON.stringify({ draftId, read: flags }),
		);
	} catch {
		// ignore storage errors
	}
}

/**
 * The stored flags for one draft, or an empty map when there are none. Callers
 * must treat a missing entry as opted **out**: a reload that could not recover
 * the choice must never re-enable reading a screenshot the user excluded.
 */
export function readSavedReadFlags(draftId: string): Record<string, boolean> {
	let parsed: unknown;
	try {
		const raw = storage()?.getItem(READ_FLAGS_KEY);
		if (!raw) return {};
		parsed = JSON.parse(raw);
	} catch {
		return {};
	}
	if (!isRecord(parsed) || parsed.draftId !== draftId) return {};
	if (!isRecord(parsed.read)) return {};
	const flags: Record<string, boolean> = {};
	for (const [id, value] of Object.entries(parsed.read))
		flags[id] = value === true;
	return flags;
}

const DRAFT_VALUES_KEY = "intake_draft_values";

/**
 * The values carried across when the employee abandons the assistant for the
 * plain form. Written by the composer, read exactly once by the form: this used
 * to be read on every render and never removed, so once a user had taken the
 * manual route every later visit to `/tickets/new` was pre-filled with a stale
 * request for the life of the tab — and with `AXIOMA_LLM_KEY` unset the manual
 * branch is the only branch, so every visit hit it.
 */
export function writeSavedDraftValues(values: Record<string, unknown>): void {
	try {
		storage()?.setItem(DRAFT_VALUES_KEY, JSON.stringify(values));
	} catch {
		// A full or blocked store just means the values do not carry across.
	}
}

const optionalString = (value: unknown): string | undefined =>
	typeof value === "string" ? value : undefined;

const optionalRecord = (value: unknown): Record<string, unknown> | undefined =>
	isRecord(value) ? value : undefined;

/** Reads the carried-over values and removes them, so they apply exactly once. */
export function takeSavedDraftValues(): SavedDraftValues | undefined {
	let parsed: unknown;
	try {
		const raw = storage()?.getItem(DRAFT_VALUES_KEY);
		storage()?.removeItem(DRAFT_VALUES_KEY);
		if (!raw) return undefined;
		parsed = JSON.parse(raw);
	} catch {
		return undefined;
	}
	if (!isRecord(parsed)) return undefined;
	return {
		title: optionalString(parsed.title),
		body: optionalString(parsed.body),
		impact: optionalString(parsed.impact),
		urgency: optionalString(parsed.urgency),
		deviceId: optionalString(parsed.deviceId),
		customFields: optionalRecord(parsed.customFields),
		subcategoryId: optionalString(parsed.subcategoryId),
		catalogueValues: optionalRecord(parsed.catalogueValues),
	};
}

export type SavedDraftValues = {
	title?: string;
	body?: string;
	impact?: string;
	urgency?: string;
	deviceId?: string;
	customFields?: Record<string, unknown>;
	subcategoryId?: string;
	catalogueValues?: Record<string, unknown>;
};

/** Clears the carried-over values once the manual form has been submitted. */
export function clearSavedDraftValues(): void {
	try {
		storage()?.removeItem(DRAFT_VALUES_KEY);
	} catch {
		// ignore storage errors
	}
}
