import assert from "node:assert/strict";
import { test } from "node:test";
import { dueRecurrenceOccurrences, occurrenceOrdinalAfter } from "./scheduling";
import { queueRecurrenceTask } from "./scheduling-runtime";

const rule = {
	id: "daily",
	frequency: "daily" as const,
	interval: 1,
	startsAt: new Date("2026-01-01T00:00:00.000Z"),
};

test("recurrence tasks queue instead of overlapping", async () => {
	let release = () => {};
	const order: string[] = [];
	const first = queueRecurrenceTask(async () => {
		order.push("first:start");
		await new Promise<void>((resolve) => (release = resolve));
		order.push("first:end");
	});
	const second = queueRecurrenceTask(async () => order.push("second"));
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(order, ["first:start"]);
	release();
	await Promise.all([first, second]);
	assert.deepEqual(order, ["first:start", "first:end", "second"]);
});

test("recurrence batch reports a bounded truncated page", () => {
	const due = dueRecurrenceOccurrences(
		rule,
		new Date("2026-01-10T00:00:00.000Z"),
		new Set(),
		2,
	);
	assert.equal(due.length, 2);
	assert.equal(due[1]?.occursAt.toISOString(), "2026-01-02T00:00:00.000Z");
});

test("recurrence ordinal cursor resumes after the last occurrence", () => {
	assert.equal(
		occurrenceOrdinalAfter(rule, new Date("2026-01-05T00:00:00.000Z")),
		5,
	);
});
