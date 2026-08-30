import assert from "node:assert/strict";
import { runRefetchInterval } from "./run-polling.ts";

assert.equal(
	runRefetchInterval({ state: { data: { status: "running" } } }),
	2_000,
);
for (const status of ["completed", "failed", "cancelled", "exhausted"]) {
	assert.equal(runRefetchInterval({ state: { data: { status } } }), false);
}
assert.equal(runRefetchInterval({ state: { data: null } }), false);
assert.equal(runRefetchInterval({ state: {} }), false);

console.log("run polling validation passed");
