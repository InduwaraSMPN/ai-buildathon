import assert from "node:assert/strict";
import test from "node:test";
import {
	clearSavedDraft,
	forgetReadFlag,
	readSavedDraftId,
	readSavedReadFlags,
	saveDraftId,
	saveReadFlags,
} from "./draft-session.ts";

// The module reads `window.sessionStorage` per call, never at import time, so a
// plain map standing in for it is enough.
const store = new Map();
globalThis.window = {
	sessionStorage: {
		getItem: (key) => (store.has(key) ? store.get(key) : null),
		setItem: (key, value) => store.set(key, String(value)),
		removeItem: (key) => store.delete(key),
	},
};

const attachment = (id, read) => ({
	key: id,
	id,
	name: `${id}.png`,
	kind: "image",
	status: "done",
	read,
});

test("an unknown draft has no stored choices, so every id reads as opted out", () => {
	store.clear();
	const flags = readSavedReadFlags("draft-1");
	assert.deepEqual(flags, {});
	assert.equal(flags["doc-1"] === true, false);
});

test("round-trips the per-attachment read flags", () => {
	store.clear();
	saveReadFlags("draft-1", [
		attachment("doc-1", true),
		attachment("doc-2", false),
	]);
	assert.deepEqual(readSavedReadFlags("draft-1"), {
		"doc-1": true,
		"doc-2": false,
	});
});

test("an attachment that never finished uploading is not recorded", () => {
	store.clear();
	saveReadFlags("draft-1", [{ ...attachment("doc-1", true), id: "" }]);
	assert.deepEqual(readSavedReadFlags("draft-1"), {});
});

test("flags saved for another draft are not reused", () => {
	store.clear();
	saveReadFlags("draft-1", [attachment("doc-1", true)]);
	assert.deepEqual(readSavedReadFlags("draft-2"), {});
});

test("anything but an explicit true is read as opted out", () => {
	store.clear();
	store.set(
		"intake_draft_attachment_reads",
		JSON.stringify({
			draftId: "draft-1",
			read: { "doc-1": "true", "doc-2": 1, "doc-3": null, "doc-4": true },
		}),
	);
	assert.deepEqual(readSavedReadFlags("draft-1"), {
		"doc-1": false,
		"doc-2": false,
		"doc-3": false,
		"doc-4": true,
	});
});

test("a corrupt record is treated as unknown rather than trusted", () => {
	store.clear();
	store.set("intake_draft_attachment_reads", "{not json");
	assert.deepEqual(readSavedReadFlags("draft-1"), {});
	store.set(
		"intake_draft_attachment_reads",
		JSON.stringify({ draftId: "draft-1" }),
	);
	assert.deepEqual(readSavedReadFlags("draft-1"), {});
});

test("an unlinked document's choice is forgotten, leaving the others alone", () => {
	store.clear();
	saveReadFlags("draft-1", [
		attachment("doc-1", true),
		attachment("doc-2", false),
	]);
	forgetReadFlag("draft-1", "doc-1");
	assert.deepEqual(readSavedReadFlags("draft-1"), { "doc-2": false });
	// A document that reuses the id must not inherit the old opt-in.
	assert.equal(readSavedReadFlags("draft-1")["doc-1"] === true, false);
});

test("forgetting an id is a no-op for an unknown draft or document", () => {
	store.clear();
	saveReadFlags("draft-1", [attachment("doc-1", true)]);
	forgetReadFlag("draft-1", "doc-9");
	forgetReadFlag("draft-2", "doc-1");
	assert.deepEqual(readSavedReadFlags("draft-1"), { "doc-1": true });
});

test("discarding a draft clears the id and the read flags together", () => {
	store.clear();
	saveDraftId("draft-1");
	saveReadFlags("draft-1", [attachment("doc-1", true)]);
	assert.equal(readSavedDraftId(), "draft-1");
	clearSavedDraft();
	assert.equal(readSavedDraftId(), null);
	assert.deepEqual(readSavedReadFlags("draft-1"), {});
});
