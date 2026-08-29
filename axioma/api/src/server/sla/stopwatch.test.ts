import assert from "node:assert/strict";
import test from "node:test";
import { elapsedWorkingMs, type WorkingCalendar } from "./calendar";
import {
	createStopwatch,
	pauseStopwatch,
	startStopwatch,
	transitionStopwatch,
} from "./stopwatch";

const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 9, minute));

test("stopwatch accumulates running and pending working time independently", () => {
	const initial = createStopwatch(at(0));
	const paused = pauseStopwatch(initial, at(10), 10 * 60_000);
	assert.deepEqual(paused, {
		accumulatedMs: 10 * 60_000,
		pendingMs: 0,
		running: false,
		startedAt: at(10),
	});

	const resumed = startStopwatch(paused, at(25), 15 * 60_000);
	assert.deepEqual(resumed, {
		accumulatedMs: 10 * 60_000,
		pendingMs: 15 * 60_000,
		running: true,
		startedAt: at(25),
	});

	assert.equal(
		transitionStopwatch(resumed, true, at(30), 2 * 60_000).accumulatedMs,
		12 * 60_000,
	);
});

test("transitionStopwatch closed period", async () => {
	const calendar: WorkingCalendar = {
		timezone: "America/New_York",
		hours: [1, 2, 3, 4, 5].map((weekday) => ({
			weekday,
			startTime: "09:00:00",
			endTime: "17:00:00",
		})),
		holidays: [],
	};
	const friday = new Date("2026-08-28T20:30:00.000Z");
	const monday = new Date("2026-08-31T13:30:00.000Z");
	const elapsedMs = await elapsedWorkingMs(
		friday,
		monday,
		"test",
		async () => calendar,
	);

	assert.deepEqual(
		transitionStopwatch(createStopwatch(friday), false, monday, elapsedMs),
		{
			accumulatedMs: 60 * 60_000,
			pendingMs: 0,
			running: false,
			startedAt: monday,
		},
	);
});

test("repeated transitions checkpoint time without losing it", () => {
	const started = createStopwatch(at(0));
	const checkpoint = startStopwatch(started, at(5), 5 * 60_000);
	const paused = pauseStopwatch(checkpoint, at(8), 3 * 60_000);
	const stillPaused = pauseStopwatch(paused, at(18), 10 * 60_000);

	assert.equal(stillPaused.accumulatedMs, 8 * 60_000);
	assert.equal(stillPaused.pendingMs, 10 * 60_000);
});

test("stopwatch rejects corrupt or backwards transitions", () => {
	const started = createStopwatch(at(10));
	assert.throws(() => pauseStopwatch(started, at(9), 0), /backwards/);
	assert.throws(() => pauseStopwatch(started, at(11), -1), /elapsedMs/);
	assert.throws(() => createStopwatch(new Date(Number.NaN)), /Invalid/);
});
