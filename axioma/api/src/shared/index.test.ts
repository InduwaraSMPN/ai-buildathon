import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { capability } from "../contracts/shared";
import { db } from "../db";
import {
	CAPABILITIES,
	derivePriority,
	IMPACT_LEVELS,
	URGENCY_LEVELS,
} from "./index";

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

test("contract and runtime capability lists match", () => {
	assert.deepEqual(capability.options, CAPABILITIES);
});

test("database capability checks match the runtime vocabulary", async () => {
	const result = await db.execute(sql<{ definition: string }>`
		select pg_get_constraintdef(oid) definition
		from pg_constraint
		where conname in ('role_capabilities_key_check', 'role_grants_capability_check')
	`);
	assert.equal(result.rows.length, 2);
	for (const row of result.rows as Array<{ definition: string }>) {
		const definition = String(row.definition);
		assert.deepEqual(
			CAPABILITIES.filter((key) => definition.includes(`'${key}'`)),
			[...CAPABILITIES],
		);
	}
});

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
