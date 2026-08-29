import assert from "node:assert/strict";
import test from "node:test";
import {
	createApiKey,
	FixedWindowRateLimiter,
	parseApiKey,
	validateCapabilitySubset,
	verifyApiKeySecret,
} from "./core";

const now = new Date("2026-01-01T00:00:00.000Z");

function issue(capabilities = ["ticket.read.own"]) {
	return createApiKey(
		{
			userId: "user-1",
			name: "CLI",
			capabilities,
			issuerCapabilities: ["ticket.read.own", "tickets:write"],
		},
		now,
	);
}

test("creates an opaque key and stores only its hash with a default expiry", () => {
	const created = issue();
	const parsed = parseApiKey(created.token);

	assert.ok(parsed);
	assert.equal(created.record.prefix, parsed.prefix);
	assert.equal(created.record.secretHash.includes(parsed.secret), false);
	assert.equal(
		verifyApiKeySecret(parsed.secret, created.record.secretHash),
		true,
	);
	assert.equal(
		verifyApiKeySecret(`${parsed.secret}x`, created.record.secretHash),
		false,
	);
	assert.equal(
		created.record.expiresAt.getTime() - now.getTime(),
		90 * 24 * 60 * 60 * 1_000,
	);
});

test("rejects malformed keys, invalid expiry, and issuer capability escalation", () => {
	assert.equal(parseApiKey("axk_bad"), null);
	assert.throws(
		() => issue(["ticket.close"]),
		/Issuer lacks capability: ticket.close/,
	);
	assert.throws(
		() =>
			createApiKey(
				{
					userId: "user-1",
					name: "expired",
					capabilities: [],
					issuerCapabilities: [],
					expiresAt: now,
				},
				now,
			),
		/future/,
	);
});

test("validates caller capabilities against the shared vocabulary", () => {
	assert.throws(
		() =>
			validateCapabilitySubset(["future:capability"], ["future:capability"]),
		/Unknown capability/,
	);
	assert.throws(
		() =>
			validateCapabilitySubset(
				["ticket.read.own", "ticket.read.own"],
				["ticket.read.own"],
			),
		/Duplicate/,
	);
	assert.throws(
		() => validateCapabilitySubset([" ticket.read.own"], [" ticket.read.own"]),
		/trimmed/,
	);
});

test("fixed-window limiter enforces per-key and global limits and reports retry timing", () => {
	const perKey = new FixedWindowRateLimiter({
		perKey: 2,
		global: 10,
		windowMs: 1_000,
	});
	assert.equal(perKey.consume("a", 100).allowed, true);
	assert.deepEqual(perKey.consume("a", 200), {
		allowed: true,
		remaining: 0,
		resetAt: new Date(1_000),
	});
	assert.deepEqual(perKey.consume("a", 250), {
		allowed: false,
		remaining: 0,
		resetAt: new Date(1_000),
		retryAfterMs: 750,
	});
	assert.equal(perKey.consume("a", 1_000).allowed, true);

	const global = new FixedWindowRateLimiter({
		perKey: 5,
		global: 2,
		windowMs: 1_000,
	});
	assert.equal(global.consume("a", 0).allowed, true);
	assert.equal(global.consume("b", 1).allowed, true);
	assert.deepEqual(global.consume("c", 2), {
		allowed: false,
		remaining: 0,
		resetAt: new Date(1_000),
		retryAfterMs: 998,
	});
});
