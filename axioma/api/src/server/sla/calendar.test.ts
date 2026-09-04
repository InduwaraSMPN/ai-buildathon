import assert from "node:assert/strict";
import test from "node:test";
import {
	addWorkingMs,
	type CalendarLoader,
	elapsedWorkingMs,
	subtractWorkingMs,
	type WorkingCalendar,
} from "./calendar";

const HOUR = 60 * 60 * 1000;
const base: WorkingCalendar = {
	timezone: "America/New_York",
	hours: [1, 2, 3, 4, 5].map((weekday) => ({
		weekday,
		startTime: "09:00:00",
		endTime: "17:00:00",
	})),
	holidays: [],
};

function loader(calendar: WorkingCalendar): CalendarLoader {
	return async () => calendar;
}

test("Friday 16:00 to Monday 10:00 has two working hours elapsed", async () => {
	const friday = new Date("2026-08-28T20:00:00.000Z");
	const monday = new Date("2026-08-31T14:00:00.000Z");
	assert.equal(
		await elapsedWorkingMs(friday, monday, "test", loader(base)),
		2 * HOUR,
	);
	assert.deepEqual(
		await addWorkingMs(friday, HOUR, "test", loader(base)),
		new Date("2026-08-28T21:00:00.000Z"),
	);
});

test("Monday holiday shifts Monday 10:00 deadline to Tuesday", async () => {
	const calendar = { ...base, holidays: ["2026-08-31"] };
	const friday = new Date("2026-08-28T20:00:00.000Z");
	const tuesday = new Date("2026-09-01T14:00:00.000Z");
	assert.equal(
		await elapsedWorkingMs(friday, tuesday, "test", loader(calendar)),
		2 * HOUR,
	);
	assert.deepEqual(
		await addWorkingMs(friday, 2 * HOUR, "test", loader(calendar)),
		tuesday,
	);
});

test("calendar timezone, not process timezone, defines working hours", async () => {
	const from = new Date("2026-08-31T13:00:00.000Z");
	const to = new Date("2026-08-31T14:00:00.000Z");
	assert.equal(await elapsedWorkingMs(from, to, "test", loader(base)), HOUR);
});

test("rejects reversed working hours", async () => {
	const calendar = {
		...base,
		hours: [{ weekday: 1, startTime: "17:00:00", endTime: "09:00:00" }],
	};
	await assert.rejects(
		elapsedWorkingMs(
			new Date("2026-08-31T13:00:00.000Z"),
			new Date("2026-08-31T14:00:00.000Z"),
			"test",
			loader(calendar),
		),
		/after they start/,
	);
});

test("rejects semantically equal working hours with different precision", async () => {
	const calendar = {
		...base,
		hours: [{ weekday: 1, startTime: "09:00", endTime: "09:00:00" }],
	};
	await assert.rejects(
		elapsedWorkingMs(
			new Date("2026-08-31T13:00:00.000Z"),
			new Date("2026-08-31T14:00:00.000Z"),
			"test",
			loader(calendar),
		),
		/after they start/,
	);
});

test("caps calendar traversal at 366 days instead of failing", async () => {
	const from = new Date("2025-01-01T00:00:00.000Z");
	assert.equal(
		await elapsedWorkingMs(
			from,
			new Date("2027-01-01T00:00:00.000Z"),
			"test",
			loader(base),
		),
		await elapsedWorkingMs(
			from,
			new Date("2026-01-02T00:00:00.000Z"),
			"test",
			loader(base),
		),
	);
	assert.deepEqual(
		await addWorkingMs(from, 10_000 * HOUR, "test", loader(base)),
		new Date("2026-01-02T00:00:00.000Z"),
	);
});

test("subtracting working time walks back to the deadline already passed", async () => {
	const monday = new Date("2026-08-31T14:00:00.000Z");
	assert.deepEqual(
		await subtractWorkingMs(monday, 2 * HOUR, "test", loader(base)),
		new Date("2026-08-28T20:00:00.000Z"),
	);
});
