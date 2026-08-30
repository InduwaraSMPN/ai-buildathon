import assert from "node:assert/strict";
import test from "node:test";
import { ORPCError } from "@orpc/server";
import {
	canRerun,
	findTicketTransition,
	preserveUndefined,
	resolveTicketStatus,
	type TicketTransition,
	ticketRunOrigin,
} from "./tickets";

test("ticket run origin prefers mail, then channel, then portal", () => {
	assert.equal(ticketRunOrigin("monitoring", "customer-chat"), "monitoring");
	assert.equal(ticketRunOrigin(null, "customer-chat"), "customer-chat");
	assert.equal(ticketRunOrigin(), "portal");
});

test("ticket lifecycle table has the expected 31 edges", async () => {
	const { db } = await import("@/db");
	const { ticketStatusTransitions } = await import("@/db/schema");
	const rows = await db.select().from(ticketStatusTransitions);
	assert.equal(rows.length, 31);
	assert.ok(
		rows.some(
			(row) =>
				row.fromStatus === "open" &&
				row.action === "startRun" &&
				row.toStatus === "routing",
		),
	);
});

test("firstTool is offered once and skipped after resolving starts", async () => {
	assert.equal(await findTicketTransition("routing", "firstTool"), "resolving");
	assert.equal(await findTicketTransition("resolving", "firstTool"), undefined);
});

test("ticket lifecycle covers every state-changing transition", async () => {
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
		assert.equal(await resolveTicketStatus(from, action), to);
});

test("reruns require a startRun transition and failed or exhausted latest run", async () => {
	assert.equal(await canRerun("escalated", "failed"), true);
	assert.equal(await canRerun("escalated", "exhausted"), true);
	assert.equal(await canRerun("escalated", "resolved"), false);
	assert.equal(await canRerun("open", "failed"), true);
	assert.equal(await canRerun("resolved", "failed"), false);
	assert.equal(await canRerun("escalated"), false);
});

test("pending lifecycle pauses and returns to open", async () => {
	for (const status of ["open", "routing", "resolving"])
		assert.equal(await resolveTicketStatus(status, "pend"), "pending");
	assert.equal(await resolveTicketStatus("pending", "unpend"), "open");
	assert.equal(await resolveTicketStatus("pending", "resolve"), "resolved");
});

test("employees can add details without changing active state", async () => {
	for (const status of ["open", "routing", "resolving"] as const)
		assert.equal(await resolveTicketStatus(status, "add_detail"), status);
});

test("classification preserves omitted values and applies changes", () => {
	assert.equal(preserveUndefined(undefined, "incident"), "incident");
	assert.equal(
		preserveUndefined("service_request", "incident"),
		"service_request",
	);
	assert.equal(preserveUndefined(null, "infrastructure"), null);
});

test("classification and assignment preserve active state", async () => {
	for (const status of [
		"open",
		"routing",
		"resolving",
		"resolved",
		"escalated",
	] as const)
		for (const action of ["reclassify", "assign"] as TicketTransition[])
			assert.equal(await resolveTicketStatus(status, action), status);
});

test("invalid lifecycle transitions return a named conflict", async () => {
	for (const [status, action] of [
		["open", "close"],
		["routing", "escalate"],
		["resolving", "close"],
		["escalated", "reopen"],
	] as const) {
		await assert.rejects(
			() => resolveTicketStatus(status, action),
			(error) =>
				error instanceof ORPCError &&
				error.code === "CONFLICT" &&
				error.message.includes(action) &&
				error.message.includes(status),
		);
	}
});
