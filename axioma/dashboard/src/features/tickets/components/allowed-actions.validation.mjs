import assert from "node:assert/strict";
import { allowedActions } from "./allowed-actions.ts";

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
	"close",
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
assert.deepEqual(allowedActions(ticket("Unknown", "open"), all, now), []);
assert.ok(
	!allowedActions(ticket("Resolving", "open"), all, now).includes("add_detail"),
);

console.log("ticket allowed-actions validation passed");
