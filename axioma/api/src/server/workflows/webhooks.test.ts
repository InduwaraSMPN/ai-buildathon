import assert from "node:assert/strict";
import test from "node:test";
import { sendWebhookRequest, webhookAttemptResult } from "./webhooks";

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
