import assert from "node:assert/strict";
import { formatSlaTarget } from "./sla-countdown.tsx";

const target = {
	remainingMs: 90 * 60_000,
	elapsedMs: 30 * 60_000,
	running: true,
	breached: false,
	attained: null,
};
assert.equal(formatSlaTarget(target), "1h 30m remaining");
assert.equal(
	formatSlaTarget({ ...target, running: false }),
	"Paused · 1h 30m remaining",
);
assert.equal(
	formatSlaTarget({ ...target, remainingMs: -30 * 60_000, breached: true }),
	"Breached by 30m",
);
assert.equal(formatSlaTarget({ ...target, attained: true }), "Met in 30m");

console.log("SLA countdown validation passed");
