import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	normalizeTicketQueueSearch,
	SEEDED_TICKET_STATUS_KEYS,
	toTicketListInput,
} from "./queue-search.ts";

const normalized = normalizeTicketQueueSearch({
	status: "open",
	priority: ["P1", "P2", "bogus"],
	recordType: "incident",
	serviceId: ["service-1", "service-2", "service-2", ""],
	route: "unassigned",
	assigneeId: "user-7",
	teamId: "team-2",
	myQueue: "true",
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
assert.deepEqual(normalized.recordType, ["incident"]);
assert.deepEqual(normalized.serviceId, ["service-1", "service-2"]);
assert.deepEqual(normalized.route, ["unassigned"]);
assert.equal(normalized.cursor, "next-page");
assert.equal(normalized.deviceId, "device-7");
assert.equal(normalized.assigneeId, "user-7");
assert.equal(normalized.teamId, "team-2");
assert.equal(normalized.myQueue, true);
assert.equal(normalized.density, "comfortable");
const input = toTicketListInput(normalized);
assert.deepEqual(input.priority, ["P1", "P2"]);
assert.deepEqual(input.recordType, ["incident"]);
assert.deepEqual(input.serviceId, ["service-1", "service-2"]);
assert.deepEqual(input.route, ["unassigned"]);
assert.equal(input.cursor, "next-page");
assert.equal(input.deviceId, "device-7");
assert.equal(input.escalatedSince?.toISOString(), "2026-08-27T12:00:00.000Z");
assert.equal(input.resolvedAt, true);
assert.equal(input.autonomous, true);
assert.equal(input.limit, 50);
assert.equal(
	normalizeTicketQueueSearch({ unassigned: "true" }).unassigned,
	true,
);
assert.equal(
	normalizeTicketQueueSearch({ status: "invalid" }).status,
	undefined,
);
assert.equal(
	normalizeTicketQueueSearch({ resolvedAt: "false" }).resolvedAt,
	undefined,
);
assert.equal(
	normalizeTicketQueueSearch({ autonomous: false }).autonomous,
	undefined,
);
// Status keys are runtime rows, so nothing in the type system ties this list
// to the database. Hold it against the seed migration instead: a status added
// there but not here is silently unfilterable in the queue, which is exactly
// the drift a bare "re-listed for URL validation" comment cannot prevent.
const seedSql = readFileSync(
	join(
		dirname(fileURLToPath(import.meta.url)),
		"../../../../../api/src/db/migrations/0000_baseline.sql",
	),
	"utf8",
);
const insert = seedSql.match(
	/INSERT INTO "ticket_statuses"[\s\S]*?ON CONFLICT/,
)?.[0];
assert.ok(insert, "could not find the ticket_statuses seed insert");
const seeded = [...insert.matchAll(/\(\s*'([a-z_]+)'\s*,/g)].map((m) => m[1]);
assert.deepEqual(
	[...seeded].sort(),
	[...SEEDED_TICKET_STATUS_KEYS].sort(),
	"queue-search status keys drifted from the ticket_statuses seed",
);

console.log("queue search validation passed");
