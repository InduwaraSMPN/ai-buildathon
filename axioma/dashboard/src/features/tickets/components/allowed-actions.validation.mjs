import assert from "node:assert/strict";
import { allowedActions } from "./allowed-actions.ts";

const now = Date.UTC(2026, 7, 29);
const ticket = (status, closedAt = null, reopenedAt = null) => ({
	status,
	closedAt,
	reopenedAt,
});

assert.deepEqual(allowedActions(ticket("open"), now), ["assign", "reclassify"]);
assert.deepEqual(allowedActions(ticket("resolving"), now), [
	"resolve",
	"escalate",
	"assign",
	"reclassify",
]);
assert.deepEqual(allowedActions(ticket("resolved"), now), [
	"close",
	"escalate",
	"assign",
	"reclassify",
]);
assert.deepEqual(allowedActions(ticket("escalated"), now), [
	"close",
	"escalate",
	"assign",
	"reclassify",
]);
assert.deepEqual(
	allowedActions(ticket("closed", new Date(now - 6 * 86_400_000)), now),
	["reopen"],
);
assert.deepEqual(
	allowedActions(ticket("closed", new Date(now - 8 * 86_400_000)), now),
	[],
);
assert.deepEqual(
	allowedActions(ticket("closed", new Date(now), new Date(now)), now),
	[],
);
assert.ok(!allowedActions(ticket("resolving"), now).includes("add_detail"));

console.log("ticket allowed-actions validation passed");
