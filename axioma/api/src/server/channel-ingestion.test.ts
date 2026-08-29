import assert from "node:assert/strict";
import test from "node:test";
import {
	normalizeChannelOrigin,
	planThreadIngestion,
} from "./channel-ingestion";

const incoming = {
	channelKey: "  Customer Chat / EU ",
	channelKind: "webchat" as const,
	externalThreadId: "thread-1",
	externalMessageId: "message-1",
	body: "  VPN is unavailable  ",
	senderRef: "employee@example.test",
	receivedAt: new Date(0),
};

test("normalizes explicit origins and falls back to the channel", () => {
	assert.equal(
		normalizeChannelOrigin({ ...incoming, origin: " Monitoring Alert " }),
		"monitoring-alert",
	);
	assert.equal(normalizeChannelOrigin(incoming), "customer-chat-eu");
});

test("an unseen thread produces stable deduplication and rule facts", () => {
	assert.deepEqual(planThreadIngestion(incoming, null), {
		deduplicationKey: "customer-chat-eu:thread-1:message-1",
		originKey: "customer-chat-eu",
		threadAction: "create",
		ticketAction: "create-via-rules",
		caseLog: null,
		ruleFacts: {
			channel: "webchat",
			channelKey: "customer-chat-eu",
			origin: "customer-chat-eu",
			sender: "employee@example.test",
			body: "VPN is unavailable",
		},
	});
});

test("an existing ticket thread becomes a public case-log append", () => {
	const plan = planThreadIngestion(incoming, {
		id: "thread-db-1",
		ticketId: "ticket-1",
	});
	assert.equal(plan.ticketAction, "append-case-log");
	assert.deepEqual(plan.caseLog, {
		ticketId: "ticket-1",
		body: "VPN is unavailable",
		visibility: "public",
		source: "channel",
	});
});

test("normalizes identifiers used by the persistence dedupe boundary", () => {
	const plan = planThreadIngestion({
		...incoming,
		externalThreadId: " thread-1 ",
		externalMessageId: " message-1 ",
	}, null);
	assert.equal(plan.deduplicationKey, "customer-chat-eu:thread-1:message-1");
});

test("rejects empty messages before persistence", () => {
	assert.throws(
		() => planThreadIngestion({ ...incoming, body: " " }, null),
		/body is required/,
	);
});
