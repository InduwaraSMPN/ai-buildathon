import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import type { createDb } from "@/db";
import { webhookDeliveries } from "@/db/schema";
import { retryDelayMs } from "./core";

type Db = ReturnType<typeof createDb>;
type Delivery = typeof webhookDeliveries.$inferSelect;
const RESPONSE_LIMIT = 64 * 1024;
const DELIVERY_LEASE_MS = 30_000;

export function webhookAttemptResult(
	attempt: number,
	maxAttempts: number,
	error: string | null,
	now: Date,
) {
	const delay = error ? retryDelayMs(attempt, { maxAttempts }) : null;
	return {
		status: error ? (delay === null ? "failed" : "retrying") : "succeeded",
		nextAttemptAt: delay === null ? null : new Date(now.getTime() + delay),
		completedAt: error && delay !== null ? null : now,
	} as const;
}

async function responseBody(response: Response): Promise<string> {
	const reader = response.body?.getReader();
	if (!reader) return "";
	const decoder = new TextDecoder();
	let size = 0;
	let body = "";
	while (size < RESPONSE_LIMIT) {
		const { done, value } = await reader.read();
		if (done) break;
		const remaining = RESPONSE_LIMIT - size;
		body += decoder.decode(value.subarray(0, remaining), { stream: true });
		size += Math.min(value.length, remaining);
	}
	await reader.cancel().catch(() => undefined);
	return body + decoder.decode();
}

export async function sendWebhookRequest(
	delivery: Pick<Delivery, "url" | "requestHeaders" | "requestBody">,
	fetcher: typeof fetch = fetch,
): Promise<{
	responseStatus: number | null;
	responseHeaders: Record<string, string> | null;
	responseBody: string | null;
	error: string | null;
}> {
	try {
		const url = new URL(delivery.url);
		if (url.protocol !== "http:" && url.protocol !== "https:")
			throw new TypeError("Webhook URL must use HTTP or HTTPS");
		const response = await fetcher(url, {
			method: "POST",
			headers: delivery.requestHeaders,
			body: delivery.requestBody,
			signal: AbortSignal.timeout(10_000),
		});
		return {
			responseStatus: response.status,
			responseHeaders: Object.fromEntries(response.headers),
			responseBody: await responseBody(response),
			error: response.ok ? null : `HTTP ${response.status}`,
		};
	} catch (cause) {
		return {
			responseStatus: null,
			responseHeaders: null,
			responseBody: null,
			error: cause instanceof Error ? cause.message : String(cause),
		};
	}
}

export async function deliverWebhook(
	db: Db,
	id: string,
	fetcher: typeof fetch = fetch,
	now = new Date(),
): Promise<Delivery | undefined> {
	const [delivery] = await db
		.update(webhookDeliveries)
		.set({
			status: "delivering",
			claimedAt: now,
			attemptCount: sql`${webhookDeliveries.attemptCount} + 1`,
		})
		.where(
			and(
				eq(webhookDeliveries.id, id),
				or(
					and(
						inArray(webhookDeliveries.status, ["pending", "retrying"]),
						or(
							sql`${webhookDeliveries.nextAttemptAt} is null`,
							lte(webhookDeliveries.nextAttemptAt, now),
						),
					),
					and(
						eq(webhookDeliveries.status, "delivering"),
						lte(
							webhookDeliveries.claimedAt,
							new Date(now.getTime() - DELIVERY_LEASE_MS),
						),
					),
				),
				sql`${webhookDeliveries.attemptCount} < ${webhookDeliveries.maxAttempts}`,
			),
		)
		.returning();
	if (!delivery) return undefined;

	const { responseStatus, responseHeaders, responseBody, error } =
		await sendWebhookRequest(delivery, fetcher);
	const result = webhookAttemptResult(
		delivery.attemptCount,
		delivery.maxAttempts,
		error,
		new Date(),
	);
	const [updated] = await db
		.update(webhookDeliveries)
		.set({
			...result,
			claimedAt: null,
			responseStatus,
			responseHeaders,
			responseBody,
			lastError: error,
		})
		.where(
			and(
				eq(webhookDeliveries.id, id),
				eq(webhookDeliveries.status, "delivering"),
			),
		)
		.returning();
	return updated;
}

async function sweepWebhookDeliveriesUnqueued(
	db: Db,
	limit = 25,
	fetcher: typeof fetch = fetch,
	now = new Date(),
): Promise<Delivery[]> {
	const due = await db
		.select({ id: webhookDeliveries.id })
		.from(webhookDeliveries)
		.where(
			and(
				or(
					and(
						inArray(webhookDeliveries.status, ["pending", "retrying"]),
						or(
							sql`${webhookDeliveries.nextAttemptAt} is null`,
							lte(webhookDeliveries.nextAttemptAt, now),
						),
					),
					and(
						eq(webhookDeliveries.status, "delivering"),
						lte(
							webhookDeliveries.claimedAt,
							new Date(now.getTime() - DELIVERY_LEASE_MS),
						),
					),
				),
				sql`${webhookDeliveries.attemptCount} < ${webhookDeliveries.maxAttempts}`,
			),
		)
		.orderBy(webhookDeliveries.createdAt)
		.limit(Math.min(Math.max(limit, 1), 100));
	const results = await Promise.all(
		due.map(({ id }) => deliverWebhook(db, id, fetcher, now)),
	);
	return results.filter((row): row is Delivery => row !== undefined);
}

let sweepQueue = Promise.resolve();
export function sweepWebhookDeliveries(
	db: Db,
	limit = 25,
	fetcher: typeof fetch = fetch,
	now = new Date(),
) {
	const run = sweepQueue.then(() =>
		sweepWebhookDeliveriesUnqueued(db, limit, fetcher, now),
	);
	sweepQueue = run.then(
		() => undefined,
		() => undefined,
	);
	return run;
}
