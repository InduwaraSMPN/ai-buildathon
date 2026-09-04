import assert from "node:assert/strict";
import test from "node:test";
import {
	addUserMessage,
	applyDraft,
	confirmSubcategory,
	fieldSourceOf,
	initialDraftState,
	reduceIntakeEvent,
	revertFieldToAi,
	setFieldValue,
} from "./draft-reducer.ts";

const completeEvent = {
	type: "complete",
	draft: {
		id: "draft-1",
		status: "open",
		intent: "incident",
		transcript: [
			{ role: "user", body: "laptop won't boot", createdAt: new Date() },
		],
		values: {
			title: "Laptop won't boot",
			body: "It stays on a black screen after pressing the power button.",
			impact: "high",
			urgency: "low",
		},
		fieldSources: {
			title: "ai",
			body: "ai",
			impact: "ai",
			urgency: "ai",
		},
		aiDraft: {
			title: {
				value: "Laptop won't boot",
				confidence: "high",
				reason: "explicit",
			},
			body: {
				value: "It stays on a black screen after pressing the power button.",
				confidence: "high",
				reason: "explicit",
			},
			impact: { value: "high", confidence: "high", reason: "inferred" },
			urgency: { value: "low", confidence: "high", reason: "inferred" },
		},
		subcategoryId: null,
		formId: null,
		ticketId: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	},
};

test("applying a complete event fills values, sources, and flags ready", () => {
	let state = initialDraftState();
	state = reduceIntakeEvent(state, { type: "status", stage: "classifying" });
	state = reduceIntakeEvent(state, completeEvent);
	assert.equal(state.ready, true);
	assert.equal(state.streaming, false);
	assert.equal(state.values.title, "Laptop won't boot");
	assert.equal(state.values.body.length > 0, true);
	assert.equal(state.fieldSources.title, "ai");
	assert.equal(fieldSourceOf(state, "title"), "ai");
	assert.equal(state.stage, "review");
});

test("an empty draft keeps the composer instead of showing a blank form", () => {
	// Restoring a session, or a turn where the model filled nothing in, used to
	// force the review stage and present an empty form with no way back.
	const emptyDraft = {
		...completeEvent.draft,
		values: {},
		fieldSources: {},
		aiDraft: { title: { value: null, confidence: "low", reason: "unclear" } },
	};
	let state = initialDraftState();
	state = applyDraft(state, emptyDraft);
	assert.equal(state.stage, "compose");
	assert.equal(state.ready, false);
	assert.equal(state.draftId, emptyDraft.id);

	// A draft carrying a summary is reviewable.
	state = applyDraft(initialDraftState(), completeEvent.draft);
	assert.equal(state.stage, "review");
	assert.equal(state.ready, true);
});

test("a user edit flips the field source from ai to user", () => {
	let state = initialDraftState();
	state = reduceIntakeEvent(state, completeEvent);
	state = setFieldValue(state, "title", "My laptop stays black");
	assert.equal(state.values.title, "My laptop stays black");
	assert.equal(state.fieldSources.title, "user");
	assert.equal(fieldSourceOf(state, "title"), "user");
});

test("revert-to-AI restores the AI value and flips the source back to ai", () => {
	let state = initialDraftState();
	state = reduceIntakeEvent(state, completeEvent);
	state = setFieldValue(state, "title", "changed by user");
	state = revertFieldToAi(state, "title");
	assert.equal(state.values.title, "Laptop won't boot");
	assert.equal(state.fieldSources.title, "ai");
	assert.equal(fieldSourceOf(state, "title"), "ai");
});

test("revert ignores fields without an AI value", () => {
	let state = initialDraftState();
	state = reduceIntakeEvent(state, completeEvent);
	state = setFieldValue(state, "deviceId", "dev-9");
	const before = state.values.deviceId;
	state = revertFieldToAi(state, "deviceId");
	assert.equal(state.values.deviceId, before);
	assert.equal(state.fieldSources.deviceId, "user");
});

test("an error event surfaces the error and stops streaming", () => {
	let state = initialDraftState();
	state = reduceIntakeEvent(state, { type: "status", stage: "retrieving" });
	state = reduceIntakeEvent(state, {
		type: "error",
		code: "MODEL_FAILED",
		message: "boom",
	});
	assert.equal(state.error?.code, "MODEL_FAILED");
	assert.equal(state.streaming, false);
	assert.equal(state.stage, "triage");
});

test("catalogue confirmation is tracked", () => {
	let state = initialDraftState();
	state = reduceIntakeEvent(state, completeEvent);
	state = confirmSubcategory(state);
	assert.equal(state.subcategoryConfirmed, true);
});

test("a field event does not overwrite a value the user has edited", () => {
	let state = initialDraftState();
	state = reduceIntakeEvent(state, completeEvent);
	state = setFieldValue(state, "title", "My laptop stays black");
	state = reduceIntakeEvent(state, {
		type: "field",
		path: "title",
		value: "Laptop won't boot",
		confidence: "high",
	});
	assert.equal(state.values.title, "My laptop stays black");
	assert.equal(state.fieldSources.title, "user");
});

test("a low-confidence field event is dropped instead of filling the field", () => {
	let state = initialDraftState();
	state = reduceIntakeEvent(state, {
		type: "field",
		path: "impact",
		value: "high",
		confidence: "low",
	});
	assert.equal(state.values.impact, undefined);
	assert.equal(state.fieldSources.impact, undefined);

	// A null value at high confidence is the same "could not determine" case.
	state = reduceIntakeEvent(state, {
		type: "field",
		path: "urgency",
		value: null,
		confidence: "high",
	});
	assert.equal(state.values.urgency, undefined);
});

test("events arriving out of order do not corrupt the draft", () => {
	// A field before any status, a status after the draft completed, and a late
	// field delta chasing a complete the user has already edited on top of.
	let state = initialDraftState();
	state = reduceIntakeEvent(state, {
		type: "field",
		path: "title",
		value: "Laptop won't boot",
		confidence: "high",
	});
	assert.equal(state.values.title, "Laptop won't boot");
	assert.equal(fieldSourceOf(state, "title"), null); // no aiDraft yet

	state = reduceIntakeEvent(state, completeEvent);
	state = setFieldValue(state, "body", "I typed this while it was streaming.");
	state = reduceIntakeEvent(state, {
		type: "field",
		path: "body",
		value: "It stays on a black screen after pressing the power button.",
		confidence: "high",
	});
	assert.equal(state.values.body, "I typed this while it was streaming.");

	state = reduceIntakeEvent(state, { type: "status", stage: "drafting" });
	assert.equal(state.streaming, true);
	assert.equal(state.stage, "review");
	assert.equal(state.values.title, "Laptop won't boot");
});

test("a complete event keeps the fields the user edited mid-stream", () => {
	let state = initialDraftState();
	state = reduceIntakeEvent(state, completeEvent);
	state = setFieldValue(state, "title", "Laptop stays on a black screen");
	state = setFieldValue(state, "impact", "low");
	// The server re-sends everything and closes with a second complete.
	state = reduceIntakeEvent(state, completeEvent);
	assert.equal(state.values.title, "Laptop stays on a black screen");
	assert.equal(state.values.impact, "low");
	assert.equal(state.fieldSources.title, "user");
	assert.equal(fieldSourceOf(state, "title"), "user");
	// Anything the user left alone still tracks the server draft.
	assert.equal(state.values.urgency, "low");
	assert.equal(fieldSourceOf(state, "urgency"), "ai");
});

test("impact and urgency stay unset when the model did not fill them", () => {
	const draft = {
		...completeEvent.draft,
		values: { title: "Printer jams", body: "Every job jams on page two." },
		fieldSources: { title: "ai", body: "ai" },
		aiDraft: {
			title: { value: "Printer jams", confidence: "high", reason: null },
			body: {
				value: "Every job jams on page two.",
				confidence: "high",
				reason: null,
			},
			impact: { value: null, confidence: "low", reason: "not stated" },
			urgency: { value: null, confidence: "low", reason: "not stated" },
		},
	};
	const state = applyDraft(initialDraftState(), draft);
	assert.equal(state.values.impact, undefined);
	assert.equal(state.values.urgency, undefined);
	assert.equal(fieldSourceOf(state, "impact"), null);
});

const containerDraft = {
	...completeEvent.draft,
	values: {
		...completeEvent.draft.values,
		customFields: { location: "Floor 3" },
		formValues: { seat: "12B" },
	},
	fieldSources: {
		...completeEvent.draft.fieldSources,
		customFields: "ai",
		formValues: "ai",
	},
	aiDraft: {
		...completeEvent.draft.aiDraft,
		// Strict structured output returns a record as a key/value entry list.
		customFields: {
			value: [{ key: "location", value: "Floor 3" }],
			confidence: "high",
			reason: "stated",
		},
	},
	subcategoryId: "sub-1",
	formId: "form-1",
};

test("dynamic and catalogue fields carry their own provenance", () => {
	const state = applyDraft(initialDraftState(), containerDraft);
	assert.equal(fieldSourceOf(state, "customFields.location"), "ai");
	// Call B fills the catalogue form after the verbatim output is stored, so
	// this one is recovered from the values the server marked AI-sourced.
	assert.equal(fieldSourceOf(state, "formValues.seat"), "ai");
	assert.equal(fieldSourceOf(state, "customFields.missing"), null);
});

test("editing and reverting a dynamic field writes through its container", () => {
	let state = applyDraft(initialDraftState(), containerDraft);
	state = setFieldValue(state, "customFields.location", "Floor 4");
	assert.equal(state.values.customFields.location, "Floor 4");
	assert.equal(state.values.location, undefined);
	assert.equal(fieldSourceOf(state, "customFields.location"), "user");

	state = revertFieldToAi(state, "customFields.location");
	assert.equal(state.values.customFields.location, "Floor 3");
	assert.equal(fieldSourceOf(state, "customFields.location"), "ai");

	state = setFieldValue(state, "formValues.seat", "14C");
	assert.equal(state.values.formValues.seat, "14C");
	state = revertFieldToAi(state, "formValues.seat");
	assert.equal(state.values.formValues.seat, "12B");
});

test("a container field event leaves an edited sibling alone", () => {
	let state = applyDraft(initialDraftState(), containerDraft);
	state = setFieldValue(state, "customFields.location", "Floor 4");
	state = reduceIntakeEvent(state, {
		type: "field",
		path: "customFields",
		value: { location: "Floor 3", asset: "A-91" },
		confidence: "high",
	});
	assert.equal(state.values.customFields.location, "Floor 4");
	assert.equal(state.values.customFields.asset, "A-91");
});

test("a deflection keeps the conversation open after the turn completes", () => {
	let state = initialDraftState();
	state = addUserMessage(state, "the vpn keeps dropping");
	state = reduceIntakeEvent(state, {
		type: "deflection",
		articles: [{ id: "kb-1", title: "Reconnect the VPN", summary: null }],
	});
	// The server closes every turn with a complete, deflection included; that
	// must not push the user into the review form or retire the composer.
	state = reduceIntakeEvent(state, completeEvent);
	assert.equal(state.stage, "triage");
	assert.equal(state.articles.length, 1);
	assert.equal(state.streaming, false);
});

test("sending a message marks the stream busy before the first event", () => {
	const state = addUserMessage(initialDraftState(), "my laptop won't boot");
	assert.equal(state.streaming, true);
	assert.equal(state.stage, "triage");
	assert.equal(state.transcript.at(-1).body, "my laptop won't boot");
});

test("low-confidence fields are not present in values", () => {
	let state = initialDraftState();
	const event = {
		type: "complete",
		draft: {
			...completeEvent.draft,
			values: {
				title: "Laptop won't boot",
			},
			fieldSources: { title: "ai" },
			aiDraft: {
				title: { value: "Laptop won't boot", confidence: "high", reason: null },
				body: { value: null, confidence: "low", reason: "unclear" },
			},
		},
	};
	state = reduceIntakeEvent(state, event);
	assert.equal(state.values.title, "Laptop won't boot");
	assert.equal(state.values.body, "");
	assert.equal(fieldSourceOf(state, "body"), null);
});
