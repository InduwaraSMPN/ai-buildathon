import assert from "node:assert/strict";
import test from "node:test";
import {
	availabilityBetween,
	dailyAvailability,
	uptimeWindows,
} from "./status";

const hour = 3_600_000;
const at = (value: string) => new Date(value);
const incident = (
	start: string,
	end: string | null,
	impactLevel = "outage",
	plannedMaintenance = false,
) => ({
	startedAt: at(start),
	resolvedAt: end ? at(end) : null,
	impactLevel,
	plannedMaintenance,
});

test("day availability derives from incidents and merges overlapping downtime", () => {
	const incidents = [
		incident("2026-08-28T01:00:00Z", "2026-08-28T03:00:00Z"),
		incident("2026-08-28T02:00:00Z", "2026-08-28T04:00:00Z"),
	];
	const [day] = dailyAvailability(
		incidents,
		{ outage: true },
		at("2026-08-28T12:00:00Z"),
		1,
	);
	assert.equal(day?.date, "2026-08-28");
	assert.equal(day?.availability, 1 - (3 * hour) / (24 * hour));
});

test("impact downtime is configurable and planned maintenance is excluded by default", () => {
	const incidents = [
		incident("2026-08-28T00:00:00Z", "2026-08-28T01:00:00Z", "degraded"),
		incident("2026-08-28T01:00:00Z", "2026-08-28T03:00:00Z", "outage", true),
	];
	const start = at("2026-08-28T00:00:00Z");
	const end = at("2026-08-28T04:00:00Z");
	assert.equal(
		availabilityBetween(
			incidents,
			{ degraded: false, outage: true },
			start,
			end,
		),
		1,
	);
	assert.equal(
		availabilityBetween(
			incidents,
			{ degraded: true, outage: true },
			start,
			end,
		),
		0.75,
	);
	assert.equal(
		availabilityBetween(
			incidents,
			{ degraded: true, outage: true },
			start,
			end,
			false,
		),
		0.25,
	);
});

test("actual planned change windows are subtracted from incident downtime", () => {
	const start = at("2026-08-28T00:00:00Z");
	const end = at("2026-08-28T04:00:00Z");
	assert.equal(
		availabilityBetween(
			[incident("2026-08-28T00:00:00Z", "2026-08-28T04:00:00Z")],
			{ outage: true },
			start,
			end,
			true,
			[
				{
					startsAt: at("2026-08-28T01:00:00Z"),
					endsAt: at("2026-08-28T03:00:00Z"),
				},
			],
		),
		0.5,
	);
});

test("uptime returns incident-derived 7, 30, and 90 day windows", () => {
	const end = at("2026-08-29T00:00:00Z");
	const incidents = [incident("2026-08-28T23:00:00Z", null)];
	const uptime = uptimeWindows(incidents, { outage: true }, end);
	assert.equal(uptime[7], 1 - hour / (7 * 24 * hour));
	assert.equal(uptime[30], 1 - hour / (30 * 24 * hour));
	assert.equal(uptime[90], 1 - hour / (90 * 24 * hour));
});

test("invalid availability windows are rejected", () => {
	assert.throws(
		() =>
			availabilityBetween(
				[],
				{},
				at("2026-08-29T00:00:00Z"),
				at("2026-08-29T00:00:00Z"),
			),
		RangeError,
	);
});
