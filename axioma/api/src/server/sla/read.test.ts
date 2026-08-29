import assert from "node:assert/strict";
import test from "node:test";
import { materializeSlaTarget } from "./read";

const startedAt = new Date("2026-01-05T09:00:00Z");
const now = new Date("2026-01-05T10:00:00Z");
const watch = {
	id: "watch",
	ticketId: "ticket",
	policyType: "sla" as const,
	policyId: "policy",
	targetType: "response" as const,
	accumulatedMs: 30 * 60_000,
	pendingMs: 0,
	running: true,
	startedAt,
	createdAt: startedAt,
	updatedAt: startedAt,
};
const policy = {
	id: "policy",
	name: "Default SLA",
	calendarId: "calendar",
	ttoWorkingMinutes: 120,
	ttrWorkingMinutes: 480,
};
const elapsed = async () => 60 * 60_000;
const add = async (from: Date, ms: number) => new Date(from.getTime() + ms);

test("running SLA target exposes calendar elapsed, remaining and derived due time", async () => {
	const target = await materializeSlaTarget(
		watch,
		policy,
		{ stateType: "new", pausesSla: false },
		now,
		elapsed,
		add,
	);
	assert.equal(target.elapsedMs, 90 * 60_000);
	assert.equal(target.remainingMs, 30 * 60_000);
	assert.equal(target.attained, null);
	assert.equal(target.dueAt?.toISOString(), "2026-01-05T10:30:00.000Z");
});

test("paused target stays stable and is not counted as attained", async () => {
	const target = await materializeSlaTarget(
		{ ...watch, running: false, pendingMs: 45 * 60_000 },
		policy,
		{ stateType: "pending", pausesSla: true },
		now,
		async () => {
			throw new Error("paused target must not accrue");
		},
		add,
	);
	assert.equal(target.elapsedMs, 30 * 60_000);
	assert.equal(target.pendingMs, 45 * 60_000);
	assert.equal(target.attained, null);
	assert.equal(target.dueAt, null);
});

test("completed target reports a miss", async () => {
	const target = await materializeSlaTarget(
		{ ...watch, running: false, accumulatedMs: 121 * 60_000 },
		policy,
		{ stateType: "open", pausesSla: false },
		now,
		elapsed,
		add,
	);
	assert.equal(target.breached, true);
	assert.equal(target.attained, false);
	assert.equal(target.remainingMs, -60_000);
});
