import assert from "node:assert/strict";
import { extractEscalationDetails } from "./escalation.ts";

const schedulerMessage = "0/3 nodes are available: 3 Insufficient cpu";
const base = {
	id: "run",
	ticketId: "ticket",
	status: "escalated",
	model: null,
	outcome: null,
	promptTokens: null,
	completionTokens: null,
	startedAt: new Date(),
	endedAt: new Date(),
};
const step = (ordinal, values) => ({
	id: String(ordinal),
	runId: "run",
	ordinal,
	kind: "observation",
	reasoning: null,
	toolName: null,
	toolInput: null,
	toolOutput: null,
	error: null,
	evidence: null,
	createdAt: new Date(),
	...values,
});

// The scheduler message is the last observation carrying evidence — the
// dashboard no longer re-scans evidence text with failure keywords (the
// agent now marks each step's evidenceTone instead).
const details = extractEscalationDetails({
	...base,
	steps: [
		step(1, { evidence: "Pod is pending" }),
		step(2, { evidence: schedulerMessage }),
		step(3, {
			kind: "tool_call",
			toolName: "cluster_patch_image",
			toolInput: {
				namespace: "analytics",
				name: "worker",
				container_index: 0,
				image: "worker:v2",
			},
		}),
	],
});
assert.equal(details?.schedulerMessage, schedulerMessage);
assert.deepEqual(details?.patchLines, [
	"- analytics/worker containers[0].image: (current)",
	"+ analytics/worker containers[0].image: worker:v2",
]);

const describedPatch = extractEscalationDetails({
	...base,
	steps: [
		step(1, {
			kind: "decision",
			toolOutput: {
				description: JSON.stringify({
					namespace: "analytics",
					name: "worker",
					container_index: 0,
					image: "worker:v3",
				}),
			},
		}),
	],
});
assert.deepEqual(describedPatch?.patchLines, [
	"- analytics/worker containers[0].image: (current)",
	"+ analytics/worker containers[0].image: worker:v3",
]);

const arbitrary = extractEscalationDetails({
	...base,
	steps: [
		step(1, { kind: "decision", toolOutput: { description: "Call platform" } }),
	],
});
assert.equal(
	arbitrary,
	null,
	"arbitrary decision output must not become a patch",
);

const structuredButUnreliable = extractEscalationDetails({
	...base,
	steps: [
		step(1, {
			kind: "decision",
			toolOutput: { description: '{"message":"Call platform"}' },
		}),
	],
});
assert.equal(
	structuredButUnreliable,
	null,
	"unrecognized structured descriptions must not become patches",
);

console.log("escalation extraction validation passed");
