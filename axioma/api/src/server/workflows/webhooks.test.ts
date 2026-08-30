import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { webhookDeliveries } from "@/db/schema";
import {
	deliverWebhook,
	sendWebhookRequest,
	sweepWebhookDeliveries,
	webhookAttemptResult,
} from "./webhooks";

const now = new Date("2026-01-01T00:00:00.000Z");

test("sends a POST and captures the bounded HTTP response", async () => {
	let request: { url: string; method?: string; body?: unknown } | undefined;
	const result = await sendWebhookRequest(
		{
			url: "https://example.test/hook",
			requestHeaders: { "x-test": "1" },
			requestBody: '{"ok":true}',
		},
		async (url, init) => {
			request = { url: String(url), method: init?.method, body: init?.body };
			return new Response("accepted", {
				status: 202,
				headers: { "x-result": "yes" },
			});
		},
	);
	assert.deepEqual(request, {
		url: "https://example.test/hook",
		method: "POST",
		body: '{"ok":true}',
	});
	assert.equal(result.responseStatus, 202);
	assert.equal(result.responseHeaders?.["x-result"], "yes");
	assert.equal(result.responseBody, "accepted");
	assert.equal(result.error, null);
});

test("captures HTTP errors and rejects non-HTTP URLs", async () => {
	assert.equal(
		(
			await sendWebhookRequest(
				{
					url: "https://example.test/hook",
					requestHeaders: {},
					requestBody: "{}",
				},
				async () => new Response("down", { status: 503 }),
			)
		).error,
		"HTTP 503",
	);
	assert.match(
		(
			await sendWebhookRequest(
				{ url: "file:///tmp/hook", requestHeaders: {}, requestBody: "{}" },
				async () => new Response(),
			)
		).error ?? "",
		/HTTP or HTTPS/,
	);
});

test("webhook attempts succeed without another retry", () => {
	assert.deepEqual(webhookAttemptResult(1, 5, null, now), {
		status: "succeeded",
		nextAttemptAt: null,
		completedAt: now,
	});
});

test("reclaims stale deliveries, leaves fresh claims, and settles from completion time", async () => {
	const staleId = crypto.randomUUID();
	const freshId = crypto.randomUUID();
	const claimedAt = new Date(Date.now() - 60_000);
	await db.insert(webhookDeliveries).values([
		{
			id: staleId,
			url: "https://example.test/stale",
			requestBody: "{}",
			status: "delivering",
			attemptCount: 1,
			claimedAt,
		},
		{
			id: freshId,
			url: "https://example.test/fresh",
			requestBody: "{}",
			status: "delivering",
			attemptCount: 1,
			claimedAt: new Date(),
		},
	]);
	try {
		const startedAt = new Date();
		const results = await sweepWebhookDeliveries(
			db,
			25,
			async () => new Response("ok"),
			new Date(),
		);
		assert.equal(
			results.some(({ id }) => id === staleId),
			true,
		);
		assert.equal(
			results.some(({ id }) => id === freshId),
			false,
		);
		const [stale] = await db
			.select()
			.from(webhookDeliveries)
			.where(eq(webhookDeliveries.id, staleId));
		assert.equal(stale?.status, "succeeded");
		assert.equal(stale?.claimedAt, null);
		assert.ok((stale?.completedAt?.getTime() ?? 0) >= startedAt.getTime());
	} finally {
		await db.delete(webhookDeliveries).where(eq(webhookDeliveries.id, staleId));
		await db.delete(webhookDeliveries).where(eq(webhookDeliveries.id, freshId));
	}
});

test("a final-attempt delivering webhook is never reclaimed", async () => {
	const id = crypto.randomUUID();
	await db.insert(webhookDeliveries).values({
		id,
		url: "https://example.test/final",
		requestBody: "{}",
		status: "delivering",
		attemptCount: 5,
		maxAttempts: 5,
		claimedAt: new Date(Date.now() - 60_000),
	});
	try {
		assert.equal(
			await deliverWebhook(db, id, async () => new Response("unexpected")),
			undefined,
		);
	} finally {
		await db.delete(webhookDeliveries).where(eq(webhookDeliveries.id, id));
	}
});

test("webhook attempts retry with bounded exponential backoff", () => {
	assert.deepEqual(webhookAttemptResult(2, 5, "HTTP 503", now), {
		status: "retrying",
		nextAttemptAt: new Date(now.getTime() + 2_000),
		completedAt: null,
	});
	assert.deepEqual(webhookAttemptResult(5, 5, "HTTP 503", now), {
		status: "failed",
		nextAttemptAt: null,
		completedAt: now,
	});
});
