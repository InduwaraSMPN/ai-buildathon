import assert from "node:assert/strict";
import { allowedActions, ticketStatusTone } from "./allowed-actions.ts";

const now = Date.UTC(2026, 7, 29);
const ticket = (
	statusLabel,
	statusStateType,
	closedAt = null,
	reopenedAt = null,
) => ({
	statusLabel,
	statusStateType,
	closedAt,
	reopenedAt,
});
const all = [
	"ticket.resolve",
	"ticket.close",
	"ticket.escalate",
	"ticket.assign",
	"ticket.reopen",
	"ticket.reclassify",
];

assert.deepEqual(allowedActions(ticket("Open", "new"), all, now), [
	"assign",
	"reclassify",
	"pend",
]);
assert.deepEqual(allowedActions(ticket("Resolving", "open"), all, now), [
	"resolve",
	"escalate",
	"assign",
	"reclassify",
]);
assert.deepEqual(allowedActions(ticket("Resolved", "resolved"), all, now), [
	"close",
	"escalate",
	"assign",
	"reclassify",
]);
assert.deepEqual(allowedActions(ticket("Escalated", "open"), all, now), [
	"resolve",
	"escalate",
	"assign",
	"reclassify",
]);
assert.deepEqual(
	allowedActions(
		ticket("Closed", "closed", new Date(now - 6 * 86_400_000)),
		all,
		now,
	),
	["reopen"],
);
assert.deepEqual(
	allowedActions(
		ticket("Closed", "closed", new Date(now - 8 * 86_400_000)),
		all,
		now,
	),
	[],
);
assert.deepEqual(
	allowedActions(
		ticket("Closed", "closed", new Date(now), new Date(now)),
		all,
		now,
	),
	[],
);
assert.deepEqual(
	allowedActions(ticket("Resolving", "open"), ["ticket.resolve"], now),
	["resolve"],
);
assert.deepEqual(allowedActions(ticket("Open", "new"), [], now), []);
assert.deepEqual(allowedActions(ticket("Renamed by admin", "open"), all, now), [
	"resolve",
	"escalate",
	"assign",
	"reclassify",
]);
assert.deepEqual(allowedActions(ticket("Anything", "merged"), all, now), []);
assert.deepEqual(allowedActions(ticket("Anything", "cancelled"), all, now), []);
assert.ok(
	!allowedActions(ticket("Resolving", "open"), all, now).includes("add_detail"),
);
for (const stateType of [
	"new",
	"open",
	"pending",
	"resolved",
	"closed",
	"merged",
	"cancelled",
]) {
	assert.ok(ticketStatusTone(stateType), `${stateType} must have a tone`);
}
assert.equal(ticketStatusTone("unknown"), undefined);

console.log("ticket allowed-actions validation passed");
