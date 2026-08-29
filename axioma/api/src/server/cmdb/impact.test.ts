import assert from "node:assert/strict";
import test from "node:test";
import { type ImpactEdge, traverseImpact } from "./impact";

const edge = (
	id: string,
	sourceObjectId: string,
	targetObjectId: string,
	impactDirection: ImpactEdge["impactDirection"] = "forward",
	spreadsImpact = true,
): ImpactEdge => ({
	id,
	sourceObjectId,
	targetObjectId,
	impactDirection,
	spreadsImpact,
});

test("impact traversal is breadth-first and terminates on cycles", () => {
	const result = traverseImpact("deployment", [
		edge("1", "deployment", "application"),
		edge("2", "application", "business-process"),
		edge("3", "business-process", "deployment"),
	]);
	assert.deepEqual(
		result.map(({ objectId, depth }) => ({ objectId, depth })),
		[
			{ objectId: "deployment", depth: 0 },
			{ objectId: "application", depth: 1 },
			{ objectId: "business-process", depth: 2 },
		],
	);
});

test("impact traversal obeys direction, spreads flag, and depth ceiling", () => {
	const edges = [
		edge("1", "service", "customer", "reverse"),
		edge("2", "service", "ignored", "forward", false),
		edge("3", "service", "next", "forward"),
		edge("4", "next", "too-deep", "forward"),
	];
	assert.deepEqual(
		traverseImpact("customer", edges, 1).map((item) => item.objectId),
		["customer", "service"],
	);
});
