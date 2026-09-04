import type {
	Draft,
	DraftFieldSource,
	DraftViewState,
	FieldDraft,
	Impact,
	IntakeDraftValues,
	IntakeEvent,
	Urgency,
} from "../types";

const IMPACT_KEYS = ["high", "medium", "low"] as const;
const URGENCY_KEYS = ["high", "medium", "low"] as const;

/** The two values that hold a record of their own, addressed as `container.key`. */
const CONTAINER_KEYS = ["customFields", "formValues"] as const;

type ValueRecord = Record<string, unknown>;

function isContainerKey(key: string): boolean {
	return (CONTAINER_KEYS as readonly string[]).includes(key);
}

function asRecord(value: unknown): ValueRecord | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as ValueRecord)
		: null;
}

/**
 * Strict structured output cannot express a free-form record, so the model
 * returns `customFields` and `formValues` as a list of `{key, value}` entries.
 * The server converts them before storing, but the verbatim `aiDraft` keeps the
 * list, so both shapes have to be readable here.
 */
function toRecord(value: unknown): ValueRecord | null {
	if (Array.isArray(value)) {
		const out: ValueRecord = {};
		for (const entry of value) {
			const row = asRecord(entry);
			if (row && typeof row.key === "string") out[row.key] = row.value;
		}
		return out;
	}
	return asRecord(value);
}

function readValuePath(values: ValueRecord, path: string): unknown {
	const dot = path.indexOf(".");
	if (dot === -1) return values[path];
	return asRecord(values[path.slice(0, dot)])?.[path.slice(dot + 1)];
}

function writeValuePath(
	values: ValueRecord,
	path: string,
	value: unknown,
): ValueRecord {
	const dot = path.indexOf(".");
	if (dot === -1) return { ...values, [path]: value };
	const container = path.slice(0, dot);
	return {
		...values,
		[container]: {
			...(asRecord(values[container]) ?? {}),
			[path.slice(dot + 1)]: value,
		},
	};
}

function asValueRecord(values: IntakeDraftValues): ValueRecord {
	return values as unknown as ValueRecord;
}

function asFieldDraft(entry: unknown): FieldDraft | null {
	const row = asRecord(entry);
	if (!row || !("value" in row)) return null;
	if (row.confidence !== "high" && row.confidence !== "low") return null;
	return {
		value: row.value,
		confidence: row.confidence,
		reason: typeof row.reason === "string" ? row.reason : null,
	};
}

export function toIncidentValues(
	values: Record<string, unknown>,
): IntakeDraftValues {
	return {
		title: typeof values.title === "string" ? values.title : "",
		body: typeof values.body === "string" ? values.body : "",
		impact: isImpact(values.impact) ? values.impact : undefined,
		urgency: isUrgency(values.urgency) ? values.urgency : undefined,
		deviceId: typeof values.deviceId === "string" ? values.deviceId : undefined,
		customFields:
			values.customFields !== null && typeof values.customFields === "object"
				? (values.customFields as Record<string, unknown>)
				: {},
		subcategoryId:
			typeof values.subcategoryId === "string"
				? values.subcategoryId
				: undefined,
		formId: typeof values.formId === "string" ? values.formId : undefined,
		formValues:
			values.formValues !== null && typeof values.formValues === "object"
				? (values.formValues as Record<string, unknown>)
				: undefined,
	};
}

export function fromIncidentValues(
	values: IntakeDraftValues,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	if (values.title) out.title = values.title;
	if (values.body) out.body = values.body;
	if (values.impact) out.impact = values.impact;
	if (values.urgency) out.urgency = values.urgency;
	if (values.deviceId) out.deviceId = values.deviceId;
	if (Object.keys(values.customFields).length > 0) {
		out.customFields = values.customFields;
	}
	if (values.subcategoryId) out.subcategoryId = values.subcategoryId;
	if (values.formId) out.formId = values.formId;
	if (values.formValues) out.formValues = values.formValues;
	return out;
}

function isImpact(value: unknown): value is Impact {
	return (
		typeof value === "string" &&
		(IMPACT_KEYS as readonly string[]).includes(value)
	);
}

function isUrgency(value: unknown): value is Urgency {
	return (
		typeof value === "string" &&
		(URGENCY_KEYS as readonly string[]).includes(value)
	);
}

export function initialDraftState(): DraftViewState {
	return {
		draftId: null,
		stage: "compose",
		transcript: [],
		streaming: false,
		busyStage: null,
		assistantMessage: "",
		articles: [],
		values: { title: "", body: "", customFields: {} },
		fieldSources: {},
		aiDraft: null,
		intent: null,
		subcategoryId: null,
		formId: null,
		ticketId: null,
		status: "open",
		ready: false,
		subcategoryConfirmed: false,
		error: null,
	};
}

export function applyDraft(
	state: DraftViewState,
	draft: Draft,
): DraftViewState {
	const merged = mergeUserEdits(state, (draft.values ?? {}) as ValueRecord);
	const fieldSources: Record<string, DraftFieldSource> = {
		...draft.fieldSources,
	};
	for (const [path, source] of Object.entries(state.fieldSources)) {
		if (source === "user") fieldSources[path] = "user";
	}
	const ready = hasDraftedContent(merged);
	return {
		...state,
		draftId: draft.id,
		status: draft.status,
		intent: draft.intent,
		subcategoryId: draft.subcategoryId,
		formId: draft.formId,
		ticketId: draft.ticketId,
		values: toIncidentValues(merged),
		fieldSources,
		aiDraft: normalizeAiDraft(draft),
		transcript: draft.transcript.map((entry) => ({
			role: entry.role,
			body: entry.body,
			createdAt: entry.createdAt,
		})),
		ready,
		streaming: false,
		busyStage: null,
		error: null,
		stage:
			state.articles.length > 0
				? state.stage
				: ready && (state.stage === "compose" || state.stage === "triage")
					? "review"
					: state.stage,
	};
}

/**
 * The server re-sends every field and then a `complete` on every turn, so a
 * draft landing while the user was typing used to discard the edit. §3.5 makes
 * `values` the effective post-edit values, so anything the user owns wins over
 * the server copy.
 */
function mergeUserEdits(
	state: DraftViewState,
	serverValues: ValueRecord,
): ValueRecord {
	let merged: ValueRecord = { ...serverValues };
	const current = asValueRecord(state.values);
	for (const [path, source] of Object.entries(state.fieldSources)) {
		if (source !== "user") continue;
		merged = writeValuePath(merged, path, readValuePath(current, path));
	}
	return merged;
}

/**
 * Flattens the model's verbatim output into one `path -> FieldDraft` map so a
 * dynamic or catalogue field can be looked up as `customFields.<key>`. Without
 * it a container arrives as a single wrapper, every per-field lookup misses,
 * and neither the AI marker nor "revert to draft" ever renders.
 */
function normalizeAiDraft(draft: Draft): Record<string, FieldDraft> | null {
	const raw = draft.aiDraft as ValueRecord | null;
	const values = (draft.values ?? {}) as ValueRecord;
	const out: Record<string, FieldDraft> = {};
	for (const [key, entry] of Object.entries(raw ?? {})) {
		const wrapper = asFieldDraft(entry);
		if (!wrapper) continue;
		out[key] = wrapper;
		if (!isContainerKey(key)) continue;
		for (const [nested, value] of Object.entries(
			toRecord(wrapper.value) ?? {},
		)) {
			if (value === null || value === undefined) continue;
			out[`${key}.${nested}`] = {
				value,
				confidence: wrapper.confidence,
				reason: wrapper.reason,
			};
		}
	}
	// Call B fills the catalogue form after call A's verbatim output has been
	// stored, so formValues never reach aiDraft at all. Recover them from the
	// values the server itself recorded as AI-sourced.
	for (const key of CONTAINER_KEYS) {
		if (draft.fieldSources[key] !== "ai") continue;
		for (const [nested, value] of Object.entries(toRecord(values[key]) ?? {})) {
			if (value === null || value === undefined) continue;
			out[`${key}.${nested}`] ??= { value, confidence: "high", reason: null };
		}
	}
	return raw === null && Object.keys(out).length === 0 ? null : out;
}

/**
 * A draft is reviewable only once the model has produced a summary or a
 * description — the two fields the ticket cannot be created without. Restoring
 * a session used to force the review stage unconditionally, which put the user
 * on an empty form with no way back to the composer; and a turn where every
 * field came back low-confidence leaves an aiDraft but nothing worth reviewing,
 * so the conversation should continue instead.
 */
function hasDraftedContent(values: ValueRecord): boolean {
	return ["title", "body"].some((key) => {
		const value = values[key];
		return typeof value === "string" && value.trim().length > 0;
	});
}

export function reduceIntakeEvent(
	state: DraftViewState,
	event: IntakeEvent,
): DraftViewState {
	switch (event.type) {
		case "status":
			return {
				...state,
				streaming: true,
				busyStage: event.stage,
				stage: state.stage === "compose" ? "triage" : state.stage,
			};
		case "message":
			return {
				...state,
				assistantMessage: state.assistantMessage + event.delta,
				busyStage: null,
			};
		case "deflection":
			return {
				...state,
				articles: event.articles,
				stage: "triage",
				busyStage: null,
			};
		case "field": {
			if (
				event.confidence === "low" ||
				event.value === null ||
				event.value === undefined
			) {
				return state;
			}
			if (state.fieldSources[event.path] === "user") {
				return state;
			}
			const current = asValueRecord(state.values);
			const incoming = isContainerKey(event.path)
				? toRecord(event.value)
				: null;
			// A container arrives whole, so folding it in key by key is what keeps
			// a single edited dynamic field from being overwritten by its siblings.
			if (incoming) {
				let values = current;
				const fieldSources = { ...state.fieldSources };
				for (const [key, value] of Object.entries(incoming)) {
					const path = `${event.path}.${key}`;
					if (fieldSources[path] === "user") continue;
					values = writeValuePath(values, path, value);
					fieldSources[path] = "ai";
				}
				fieldSources[event.path] = "ai";
				return { ...state, values: toIncidentValues(values), fieldSources };
			}
			return {
				...state,
				values: toIncidentValues(
					writeValuePath(current, event.path, event.value),
				),
				fieldSources: { ...state.fieldSources, [event.path]: "ai" },
			};
		}
		case "complete":
			return applyDraft(state, event.draft);
		case "error":
			return {
				...state,
				error: { code: event.code, message: event.message },
				streaming: false,
				busyStage: null,
				stage: "triage",
			};
		default:
			return state;
	}
}

export function addUserMessage(
	state: DraftViewState,
	body: string,
): DraftViewState {
	return {
		...state,
		assistantMessage: "",
		articles: [],
		error: null,
		// The composer's busy flag is this, and the first `status` event only
		// arrives a round trip later — without it the send button stays live long
		// enough to start a second stream.
		streaming: true,
		busyStage: null,
		transcript: [
			...state.transcript,
			{ role: "user", body, createdAt: new Date() },
		],
		stage: "triage",
	};
}

export function setDraftId(
	state: DraftViewState,
	draftId: string,
): DraftViewState {
	return { ...state, draftId };
}

/** `path` is either a top-level key or `customFields.<key>` / `formValues.<key>`. */
export function setFieldValue(
	state: DraftViewState,
	path: string,
	value: unknown,
): DraftViewState {
	return {
		...state,
		values: toIncidentValues(
			writeValuePath(asValueRecord(state.values), path, value),
		),
		fieldSources: { ...state.fieldSources, [path]: "user" as const },
	};
}

export function revertFieldToAi(
	state: DraftViewState,
	path: string,
): DraftViewState {
	const draft = state.aiDraft?.[path];
	if (!draft || draft.value === null || draft.value === undefined) return state;
	return {
		...state,
		values: toIncidentValues(
			writeValuePath(asValueRecord(state.values), path, draft.value),
		),
		fieldSources: { ...state.fieldSources, [path]: "ai" as const },
	};
}

export function setInferredValue(
	state: DraftViewState,
	path: string,
	value: unknown,
): DraftViewState {
	return {
		...state,
		values: toIncidentValues(
			writeValuePath(asValueRecord(state.values), path, value),
		),
	};
}

export function confirmSubcategory(state: DraftViewState): DraftViewState {
	return { ...state, subcategoryConfirmed: true };
}

export function fieldSourceOf(
	state: DraftViewState,
	key: string,
): "ai" | "user" | null {
	const draft = state.aiDraft?.[key];
	if (!draft || draft.value === null) return null;
	return state.fieldSources[key] ?? "ai";
}
