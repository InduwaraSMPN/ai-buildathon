import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";
import { Client } from "pg";
import { createApiKey, FixedWindowRateLimiter } from "./api-keys/core";
import type { ApiKeyDb } from "./api-keys/resolver";
import { createApiKeyResolver } from "./api-keys/resolver";
import { assertCapabilities } from "./orpc";

const databaseUrl = process.env.DATABASE_URL;

test("Tier 3 migration preserves CMDB row count and provenance", {
	skip: !databaseUrl,
}, async () => {
	const client = new Client({ connectionString: databaseUrl });
	await client.connect();
	try {
		const {
			rows: [row],
		} = await client.query(`
			SELECT
				(SELECT count(*)::int FROM cmdb_items) legacy_rows,
				(SELECT count(*)::int FROM cmdb_objects o JOIN cmdb_items i ON i.id = o.id) migrated_rows,
				(SELECT count(*)::int FROM cmdb_items i JOIN cmdb_objects o ON o.id = i.id
				 WHERE o.source_ticket_id IS DISTINCT FROM i.source_ticket_id
				    OR o.source_run_id IS DISTINCT FROM i.source_run_id
				    OR o.source_step_id IS DISTINCT FROM i.source_step_id
				    OR o.observed_at IS DISTINCT FROM i.observed_at) provenance_mismatches
		`);
		assert.equal(row.migrated_rows, row.legacy_rows);
		assert.equal(row.provenance_mismatches, 0);
	} finally {
		await client.end();
	}
});

test("read-only API key is denied write and then rate limited", async () => {
	const now = new Date("2026-01-01T00:00:00Z");
	const created = createApiKey(
		{
			userId: "u",
			name: "readonly",
			capabilities: ["ticket.read.own"],
			issuerCapabilities: ["ticket.read.own"],
		},
		now,
	);
	const query = {
		from: () => query,
		where: () => query,
		limit: async () => [created.record],
	};
	const update = { set: () => update, where: async () => undefined };
	const resolve = createApiKeyResolver({
		db: { select: () => query, update: () => update } as unknown as ApiKeyDb,
		limiter: new FixedWindowRateLimiter({
			perKey: 1,
			global: 10,
			windowMs: 60_000,
		}),
		now: () => now,
	});
	const first = await resolve(created.token);
	assert.equal(first.ok, true);
	if (!first.ok) return;
	assert.throws(
		() =>
			assertCapabilities(
				{ capabilities: new Set(first.auth.capabilities) },
				"ticket.create",
			),
		(error: unknown) =>
			error instanceof Error && "code" in error && error.code === "FORBIDDEN",
	);
	assert.deepEqual(await resolve(created.token), {
		ok: false,
		reason: "rate_limited",
		retryAfterMs: 60_000,
		resetAt: new Date("2026-01-01T00:01:00Z"),
	});
});
