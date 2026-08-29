import assert from "node:assert/strict";
import test from "node:test";
import { derivePriority, IMPACT_LEVELS, URGENCY_LEVELS } from "./index";

const expected = {
	"high/high": "P1",
	"high/medium": "P2",
	"high/low": "P3",
	"medium/high": "P2",
	"medium/medium": "P3",
	"medium/low": "P4",
	"low/high": "P3",
	"low/medium": "P4",
	"low/low": "P4",
} as const;

test("derivePriority covers every impact and urgency pair", () => {
	for (const impact of IMPACT_LEVELS) {
		for (const urgency of URGENCY_LEVELS) {
			assert.equal(
				derivePriority(impact, urgency),
				expected[`${impact}/${urgency}`],
			);
		}
	}
	assert.equal(
		Object.keys(expected).length,
		IMPACT_LEVELS.length * URGENCY_LEVELS.length,
	);
});
