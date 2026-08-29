import assert from "node:assert/strict";
import test from "node:test";
import { SHARED_ACTION_TYPES } from "../rules";
import {
	ACTION_TYPES,
	assertWorkflowActions,
	canTriggerWorkflow,
	collapseNotificationRepeats,
	retryDelayMs,
	signWebhook,
} from "./core";

test("signWebhook uses HMAC SHA-256 and a conventional prefix", () => {
	assert.equal(
		signWebhook("The quick brown fox jumps over the lazy dog", "key"),
		"sha256=f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
	);
	assert.throws(() => signWebhook("body", ""), TypeError);
});

test("retryDelayMs exponentially backs off, caps, and stops", () => {
	const options = { baseMs: 100, maxMs: 250, maxAttempts: 4 };
	assert.equal(retryDelayMs(1, options), 100);
	assert.equal(retryDelayMs(2, options), 200);
	assert.equal(retryDelayMs(3, options), 250);
	assert.equal(retryDelayMs(4, options), null);
	assert.throws(() => retryDelayMs(0), RangeError);
});

test("workflow actions share the shared vocabulary and workflows cannot trigger workflows", () => {
	assert.deepEqual(new Set(SHARED_ACTION_TYPES), new Set(ACTION_TYPES));
	assert.deepEqual(
		assertWorkflowActions([
			{ type: "set_category", value: "device" },
			{ type: "send_webhook", value: { url: "endpoint-1" } },
		]),
		[
			{ type: "set_category", value: "device" },
			{ type: "send_webhook", value: { url: "endpoint-1" } },
		],
	);
	assert.throws(
		() => assertWorkflowActions([{ type: "run_workflow" }]),
		TypeError,
	);
	assert.equal(
		canTriggerWorkflow({ type: "ticket.resolve", source: "ticket" }),
		true,
	);
	assert.equal(canTriggerWorkflow({ type: "sla.breach", source: "sla" }), true);
	assert.equal(
		canTriggerWorkflow({ type: "workflow.done", source: "workflow" }),
		false,
	);
});

test("notifications skip own actions and collapse repeats by recipient and record", () => {
	const collapsed = collapseNotificationRepeats([
		{
			recipientId: "alice",
			actorId: "alice",
			recordType: "ticket",
			recordId: "T-1",
			eventType: "edited",
			title: "ignored",
			body: "ignored",
		},
		...Array.from({ length: 5 }, (_, index) => ({
			recipientId: "bob",
			actorId: "alice",
			recordType: "ticket",
			recordId: "T-1",
			eventType: "edited",
			title: `Edit ${index + 1}`,
			body: `Body ${index + 1}`,
		})),
		{
			recipientId: "bob",
			actorId: "alice",
			recordType: "ticket",
			recordId: "T-2",
			eventType: "edited",
			title: "Other",
			body: "Other",
		},
		{
			recipientId: "bob",
			actorId: "alice",
			recordType: "ticket",
			recordId: "T-1",
			eventType: "sla_breach",
			title: "SLA breached",
			body: "SLA breached",
		},
	]);

	assert.equal(collapsed.length, 3);
	assert.deepEqual(
		collapsed.map(({ recordId, eventCount, title }) => ({
			recordId,
			eventCount,
			title,
		})),
		[
			{ recordId: "T-1", eventCount: 5, title: "Edit 5" },
			{ recordId: "T-2", eventCount: 1, title: "Other" },
			{ recordId: "T-1", eventCount: 1, title: "SLA breached" },
		],
	);
});
