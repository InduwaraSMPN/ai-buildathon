import assert from "node:assert/strict";
import test from "node:test";
import { createApiKey, FixedWindowRateLimiter } from "./core";
import type { ApiKeyDb } from "./resolver";
import { bearerToken, createApiKeyResolver, toApiKeyAuth } from "./resolver";

function fakeDb(row: unknown) {
	let updated: unknown;
	const query = {
		from: () => query,
		where: () => query,
		limit: async () => (row ? [row] : []),
	};
	const update = {
		set: (value: unknown) => {
			updated = value;
			return update;
		},
		where: async () => undefined,
	};
	return {
		db: {
			select: () => query,
			update: () => update,
		} as unknown as ApiKeyDb,
		updated: () => updated,
	};
}

test("extracts bearer tokens and exposes a minimal context auth shape", () => {
	assert.equal(
		bearerToken(new Headers({ authorization: "Bearer axk_token" })),
		"axk_token",
	);
	assert.equal(bearerToken(new Headers({ authorization: "Basic nope" })), null);
	assert.deepEqual(
		toApiKeyAuth({
			id: "key-1",
			userId: "user-1",
			capabilities: ["ticket.read.own"],
		}),
		{
			kind: "api-key",
			keyId: "key-1",
			userId: "user-1",
			capabilities: ["ticket.read.own"],
		},
	);
});

test("resolver rejects malformed tokens without querying the database", async () => {
	const database = fakeDb(null);
	const resolve = createApiKeyResolver({ db: database.db });
	assert.deepEqual(await resolve("bad"), { ok: false, reason: "invalid" });
	assert.equal(database.updated(), undefined);
});

test("resolver authenticates an active key, updates usage, and applies limits", async () => {
	const now = new Date("2026-01-01T00:00:00.000Z");
	const created = createApiKey(
		{
			userId: "user-1",
			name: "CLI",
			capabilities: ["ticket.read.own"],
			issuerCapabilities: ["ticket.read.own"],
		},
		now,
	);
	const database = fakeDb(created.record);
	const resolve = createApiKeyResolver({
		db: database.db,
		limiter: new FixedWindowRateLimiter({
			perKey: 1,
			global: 10,
			windowMs: 60_000,
		}),
		now: () => now,
	});

	const first = await resolve(created.token);
	assert.equal(first.ok, true);
	assert.deepEqual(database.updated(), { lastUsedAt: now });
	assert.deepEqual(await resolve(created.token), {
		ok: false,
		reason: "rate_limited",
		retryAfterMs: 60_000,
		resetAt: new Date("2026-01-01T00:01:00.000Z"),
	});
});

test("resolver rejects revoked and expired keys before consuming limits", async () => {
	const now = new Date("2026-01-01T00:00:00.000Z");
	const created = createApiKey(
		{
			userId: "user-1",
			name: "CLI",
			capabilities: [],
			issuerCapabilities: [],
		},
		now,
	);
	const revoked = fakeDb({ ...created.record, revokedAt: now });
	assert.deepEqual(
		await createApiKeyResolver({ db: revoked.db, now: () => now })(
			created.token,
		),
		{ ok: false, reason: "revoked" },
	);

	const expired = fakeDb({
		...created.record,
		expiresAt: new Date(now.getTime() - 1),
	});
	assert.deepEqual(
		await createApiKeyResolver({ db: expired.db, now: () => now })(
			created.token,
		),
		{ ok: false, reason: "expired" },
	);
});
