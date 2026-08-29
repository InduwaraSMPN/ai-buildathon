import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";
import { Client } from "pg";
import { createApiKey, type RateLimitResult } from "./api-keys/core";
import type { ApiKeyDb } from "./api-keys/resolver";
import { createApiKeyResolver } from "./api-keys/resolver";
import { assertCapabilities } from "./orpc";

const databaseUrl = process.env.DATABASE_URL;

test("legacy CMDB storage is retired", { skip: !databaseUrl }, async () => {
	const client = new Client({ connectionString: databaseUrl });
	await client.connect();
	try {
		const {
			rows: [row],
		} = await client.query(`SELECT
			to_regclass('public.cmdb_items') legacy_table,
			to_regclass('public.cmdb_objects') replacement_table`);
		assert.equal(row.legacy_table, null);
		assert.equal(row.replacement_table, "cmdb_objects");
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
	let consumed = false;
	const consumeRateLimit = async (): Promise<RateLimitResult> => {
		const resetAt = new Date(now.getTime() + 60_000);
		if (consumed)
			return { allowed: false, remaining: 0, resetAt, retryAfterMs: 60_000 };
		consumed = true;
		return { allowed: true, remaining: 0, resetAt };
	};
	const resolve = createApiKeyResolver({
		db: { select: () => query, update: () => update } as unknown as ApiKeyDb,
		consumeRateLimit,
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
