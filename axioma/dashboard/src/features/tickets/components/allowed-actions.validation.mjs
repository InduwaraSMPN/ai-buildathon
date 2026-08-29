import assert from "node:assert/strict";
import { allowedActions } from "./allowed-actions.ts";

const now = Date.UTC(2026, 7, 29);
const ticket = (status, closedAt = null, reopenedAt = null) => ({
	status,
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

assert.deepEqual(allowedActions(ticket("open"), all, now), [
	"assign",
	"reclassify",
]);
assert.deepEqual(allowedActions(ticket("resolving"), all, now), [
	"resolve",
	"escalate",
	"assign",
	"reclassify",
]);
assert.deepEqual(allowedActions(ticket("resolved"), all, now), [
	"close",
	"escalate",
	"assign",
	"reclassify",
]);
assert.deepEqual(allowedActions(ticket("escalated"), all, now), [
	"close",
	"escalate",
	"assign",
	"reclassify",
]);
assert.deepEqual(
	allowedActions(ticket("closed", new Date(now - 6 * 86_400_000)), all, now),
	["reopen"],
);
assert.deepEqual(
	allowedActions(ticket("closed", new Date(now - 8 * 86_400_000)), all, now),
	[],
);
assert.deepEqual(
	allowedActions(ticket("closed", new Date(now), new Date(now)), all, now),
	[],
);
assert.deepEqual(allowedActions(ticket("resolving"), ["ticket.resolve"], now), [
	"resolve",
]);
assert.deepEqual(allowedActions(ticket("open"), [], now), []);
assert.deepEqual(allowedActions(ticket("unknown"), all, now), []);
assert.ok(
	!allowedActions(ticket("resolving"), all, now).includes("add_detail"),
);

console.log("ticket allowed-actions validation passed");
