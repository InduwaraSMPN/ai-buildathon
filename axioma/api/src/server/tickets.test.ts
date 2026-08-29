import assert from "node:assert/strict";
import test from "node:test";
import { ORPCError } from "@orpc/server";
import {
	canRerun,
	nextTicketStatus,
	preserveUndefined,
	type TicketTransition,
	ticketRunOrigin,
} from "./tickets";

test("ticket run origin prefers mail, then channel, then portal", () => {
	assert.equal(ticketRunOrigin("monitoring", "customer-chat"), "monitoring");
	assert.equal(ticketRunOrigin(null, "customer-chat"), "customer-chat");
	assert.equal(ticketRunOrigin(), "portal");
});

test("ticket lifecycle covers every state-changing transition", () => {
	const transitions = [
		["open", "startRun", "routing"],
		["routing", "firstTool", "resolving"],
		["resolving", "resolve", "resolved"],
		["resolving", "escalate", "escalated"],
		["resolving", "fail", "escalated"],
		["resolving", "exhaust", "escalated"],
		["resolved", "close", "closed"],
		["resolved", "escalate", "escalated"],
		["escalated", "escalate", "escalated"],
		["escalated", "startRun", "routing"],
		["escalated", "close", "closed"],
		["closed", "reopen", "open"],
	] as const;
	for (const [from, action, to] of transitions)
		assert.equal(nextTicketStatus(from, action), to);
});

test("reruns require an escalated ticket and failed or exhausted latest run", () => {
	assert.equal(canRerun("escalated", "failed"), true);
	assert.equal(canRerun("escalated", "exhausted"), true);
	assert.equal(canRerun("escalated", "resolved"), false);
	assert.equal(canRerun("open", "failed"), false);
	assert.equal(canRerun("escalated"), false);
});

test("pending lifecycle pauses and returns to open", () => {
	for (const status of ["open", "routing", "resolving"])
		assert.equal(nextTicketStatus(status, "pend"), "pending");
	assert.equal(nextTicketStatus("pending", "unpend"), "open");
	assert.equal(nextTicketStatus("pending", "resolve"), "resolved");
});

test("employees can add details without changing active state", () => {
	for (const status of ["open", "routing", "resolving"] as const)
		assert.equal(nextTicketStatus(status, "add_detail"), status);
});

test("classification preserves omitted values and applies changes", () => {
	assert.equal(preserveUndefined(undefined, "incident"), "incident");
	assert.equal(
		preserveUndefined("service_request", "incident"),
		"service_request",
	);
	assert.equal(preserveUndefined(null, "infrastructure"), null);
});

test("classification and assignment preserve active state", () => {
	for (const status of [
		"open",
		"routing",
		"resolving",
		"resolved",
		"escalated",
	] as const)
		for (const action of ["reclassify", "assign"] as TicketTransition[])
			assert.equal(nextTicketStatus(status, action), status);
});

test("invalid lifecycle transitions return a named conflict", () => {
	for (const [status, action] of [
		["open", "close"],
		["routing", "escalate"],
		["resolving", "close"],
		["escalated", "reopen"],
	] as const) {
		assert.throws(
			() => nextTicketStatus(status, action),
			(error) =>
				error instanceof ORPCError &&
				error.code === "CONFLICT" &&
				error.message.includes(action) &&
				error.message.includes(status),
		);
	}
});
