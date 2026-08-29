import assert from "node:assert/strict";
import test from "node:test";
import {
	dueRecurrenceOccurrences,
	endFromDuration,
	isVisibleInDefaultQueue,
} from "./scheduling";

test("work end is derived from a non-negative duration", () => {
	const start = new Date("2026-08-29T10:00:00.000Z");
	assert.equal(
		endFromDuration(start, 90).toISOString(),
		"2026-08-29T11:30:00.000Z",
	);
	assert.throws(() => endFromDuration(start, -1), RangeError);
});

test("due recurrence generation is deterministic and idempotent", () => {
	const rule = {
		id: "weekly-backup",
		frequency: "weekly" as const,
		interval: 1,
		startsAt: new Date("2026-08-01T09:00:00.000Z"),
	};
	const due = dueRecurrenceOccurrences(
		rule,
		new Date("2026-08-15T09:00:00.000Z"),
	);
	assert.deepEqual(
		due.map(({ occursAt }) => occursAt.toISOString()),
		[
			"2026-08-01T09:00:00.000Z",
			"2026-08-08T09:00:00.000Z",
			"2026-08-15T09:00:00.000Z",
		],
	);
	assert.deepEqual(
		dueRecurrenceOccurrences(
			rule,
			new Date("2026-08-15T09:00:00.000Z"),
			new Set(due.map((x) => x.idempotencyKey)),
		),
		[],
	);
});

test("monthly recurrence clamps to the last day without drifting", () => {
	const due = dueRecurrenceOccurrences(
		{
			id: "month-end",
			frequency: "monthly",
			interval: 1,
			startsAt: new Date("2026-01-31T12:00:00.000Z"),
		},
		new Date("2026-03-31T12:00:00.000Z"),
	);
	assert.deepEqual(
		due.map(({ occursAt }) => occursAt.toISOString()),
		[
			"2026-01-31T12:00:00.000Z",
			"2026-02-28T12:00:00.000Z",
			"2026-03-31T12:00:00.000Z",
		],
	);
});

test("snooze hides then reveals a ticket without a status input", () => {
	const now = new Date("2026-08-29T10:00:00.000Z");
	assert.equal(
		isVisibleInDefaultQueue(new Date("2026-08-29T10:01:00.000Z"), now),
		false,
	);
	assert.equal(
		isVisibleInDefaultQueue(new Date("2026-08-29T10:00:00.000Z"), now),
		true,
	);
	assert.equal(isVisibleInDefaultQueue(null, now), true);
});
