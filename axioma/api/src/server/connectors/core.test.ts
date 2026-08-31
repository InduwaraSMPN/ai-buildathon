import assert from "node:assert/strict";
import test from "node:test";
import { renderWorkNote, writebackDelayMs, writebackOutcome } from "./core";

test("backoff grows exponentially and is capped", () => {
	assert.equal(writebackDelayMs(1), 1_000);
	assert.equal(writebackDelayMs(2), 2_000);
	assert.equal(writebackDelayMs(3), 4_000);
	assert.equal(writebackDelayMs(4), 8_000);
	assert.equal(writebackDelayMs(3, { baseMs: 40_000, maxMs: 60_000 }), 60_000);
});

test("backoff terminates by returning null rather than a zero delay", () => {
	assert.equal(writebackDelayMs(5), null);
	assert.equal(writebackDelayMs(9), null);
	assert.equal(writebackDelayMs(2, { maxAttempts: 2 }), null);
});

test("a success completes immediately and schedules nothing", () => {
	const now = new Date("2026-08-30T10:00:00Z");
	const outcome = writebackOutcome(1, 5, false, now);
	assert.equal(outcome.status, "succeeded");
	assert.equal(outcome.nextAttemptAt, null);
	assert.deepEqual(outcome.completedAt, now);
});

test("a recoverable failure retries and is not marked complete", () => {
	const now = new Date("2026-08-30T10:00:00Z");
	const outcome = writebackOutcome(1, 5, true, now);
	assert.equal(outcome.status, "retrying");
	assert.equal(outcome.completedAt, null);
	assert.deepEqual(outcome.nextAttemptAt, new Date(now.getTime() + 1_000));
});

test("the final failure is terminal and completes, so it stops being swept", () => {
	const now = new Date("2026-08-30T10:00:00Z");
	const outcome = writebackOutcome(5, 5, true, now);
	assert.equal(outcome.status, "failed");
	assert.equal(outcome.nextAttemptAt, null);
	assert.deepEqual(outcome.completedAt, now);
});

test("the note leads with what the technician should do", () => {
	const note = renderWorkNote({
		shadow: true,
		status: "escalated",
		outcome: "Image tag does not resolve.",
		evidence: "ImagePullBackOff on checkout-7d9f.",
		resolutionCode: null,
		suppressedCalls: [
			{ tool: "cluster_patch_image", input: { name: "checkout" } },
		],
		runUrl: "https://axioma.example/runs/run-1",
	});
	const lines = note.split("\n").filter(Boolean);
	// The ask is the second line, above the diagnosis. An alert the reader
	// cannot act on should not exist, so the action is not buried.
	assert.match(String(lines[1]), /^What to do:/);
	assert.ok(note.indexOf("What to do:") < note.indexOf("Diagnosis:"));
});

test("a shadow note with a proposal asks for a decision", () => {
	const note = renderWorkNote({
		shadow: true,
		status: "escalated",
		outcome: null,
		evidence: null,
		resolutionCode: null,
		suppressedCalls: [{ tool: "cluster_patch_image", input: {} }],
		runUrl: null,
	});
	assert.match(note, /Review the proposal below/);
	assert.match(note, /did not act/);
});

test("a shadow note with no proposal says so rather than implying one", () => {
	const note = renderWorkNote({
		shadow: true,
		status: "escalated",
		outcome: null,
		evidence: null,
		resolutionCode: null,
		suppressedCalls: [],
		runUrl: null,
	});
	assert.match(note, /no action worth proposing/);
	assert.doesNotMatch(note, /Proposed, not taken/);
});

test("a resolved run tells the technician nothing is needed", () => {
	const note = renderWorkNote({
		shadow: false,
		status: "resolved",
		outcome: "Patched the image tag.",
		evidence: null,
		resolutionCode: "fixed",
		suppressedCalls: [],
		runUrl: null,
	});
	assert.match(note, /Nothing — the fix was applied and verified/);
	assert.match(note, /Resolution code: fixed/);
});

test("an escalated run asks for takeover", () => {
	const note = renderWorkNote({
		shadow: false,
		status: "escalated",
		outcome: "Insufficient cpu; every fix is a policy decision.",
		evidence: null,
		resolutionCode: null,
		suppressedCalls: [],
		runUrl: null,
	});
	assert.match(note, /Take this over/);
	assert.match(note, /stopped deliberately/);
});

test("an exhausted run says the findings are partial", () => {
	const note = renderWorkNote({
		shadow: false,
		status: "exhausted",
		outcome: null,
		evidence: null,
		resolutionCode: null,
		suppressedCalls: [],
		runUrl: null,
	});
	assert.match(note, /could not finish/);
	assert.match(note, /partial/);
});

test("an acting note does not claim to be a proposal", () => {
	const note = renderWorkNote({
		shadow: false,
		status: "resolved",
		outcome: "Patched the image tag.",
		evidence: null,
		resolutionCode: "fixed",
		suppressedCalls: [
			{ tool: "cluster_patch_image", input: { name: "checkout" } },
		],
		runUrl: null,
	});
	assert.match(note, /Actions taken:/);
	assert.doesNotMatch(note, /Nothing was changed/);
});
