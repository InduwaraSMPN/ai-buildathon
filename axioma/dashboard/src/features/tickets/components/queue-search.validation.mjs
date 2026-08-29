import assert from "node:assert/strict";
import {
	normalizeTicketQueueSearch,
	toTicketListInput,
} from "./queue-search.ts";

const normalized = normalizeTicketQueueSearch({
	status: "open",
	priority: ["P1", "P2", "bogus"],
	recordType: "incident",
	category: ["infrastructure", "unclassified"],
	route: "unassigned",
	deviceId: "device-7",
	search: "  printer  ",
	sortBy: "updatedAt",
	sortDirection: "desc",
	density: "comfortable",
	cursor: "next-page",
	escalatedSince: "2026-08-27T12:00:00.000Z",
	resolvedAt: "true",
	autonomous: true,
});
assert.equal(normalized.search, "printer");
assert.deepEqual(normalized.status, ["open"]);
assert.deepEqual(normalized.priority, ["P1", "P2"]);
assert.deepEqual(normalized.category, ["infrastructure", null]);
assert.equal(normalized.deviceId, "device-7");
assert.equal(normalized.density, "comfortable");
assert.deepEqual(toTicketListInput(normalized).priority, ["P1", "P2"]);
assert.equal(toTicketListInput(normalized).deviceId, "device-7");
assert.equal(
	toTicketListInput(normalized).escalatedSince?.toISOString(),
	"2026-08-27T12:00:00.000Z",
);
assert.equal(toTicketListInput(normalized).resolvedAt, true);
assert.equal(toTicketListInput(normalized).autonomous, true);
assert.equal(toTicketListInput(normalized).limit, 50);
assert.equal(
	normalizeTicketQueueSearch({ unassigned: "true" }).unassigned,
	true,
);
assert.equal(
	normalizeTicketQueueSearch({ status: "invalid" }).status,
	undefined,
);
console.log("queue search validation passed");
