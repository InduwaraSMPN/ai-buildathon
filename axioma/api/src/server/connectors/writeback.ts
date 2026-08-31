/**
 * Durable outbound work notes.
 *
 * Modelled on `workflows/webhooks.ts`, not on `mail/send.ts`. The mail sender
 * writes one row per attempt and never retries, which is acceptable for a
 * notification and not for this: a work note that silently fails to post is
 * worse than one that never existed, because the customer's technician is
 * left believing nothing happened while our transcript says otherwise.
 *
 * Claiming is an atomic conditional UPDATE … RETURNING that increments the
 * attempt count in SQL, and a `delivering` row whose lease has expired is
 * reclaimable — so a gateway restart mid-delivery does not strand the note.
 */

import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { itsmConnectors, itsmTicketOrigins, itsmWritebacks } from "@/db/schema";
import { writebackOutcome } from "./core";

export { renderWorkNote, writebackDelayMs, writebackOutcome } from "./core";

/** Matches the webhook delivery lease, for the same reason. */
const DELIVERY_LEASE_MS = 30_000;

export type WritebackTransport = {
	postWorkNote(params: {
		externalId: string;
		note: string;
		correlationId?: string;
	}): Promise<{ updatedAt: string | null; receiptId: string | null }>;
};

/** Queues a note. Called after a run reaches a terminal state. */
export async function queueWorkNote(params: {
	connectorId: string;
	ticketId: string;
	runId: string | null;
	note: string;
	externalId: string;
	correlationId?: string;
}): Promise<string> {
	const id = crypto.randomUUID();
	await db.insert(itsmWritebacks).values({
		id,
		connectorId: params.connectorId,
		ticketId: params.ticketId,
		runId: params.runId,
		kind: "work_note",
		payload: {
			note: params.note,
			externalId: params.externalId,
			correlationId: params.correlationId ?? null,
		},
		status: "pending",
		nextAttemptAt: new Date(),
	});
	return id;
}

/**
 * Claims one write-back and attempts it.
 *
 * The claim is a conditional UPDATE so two sweeps cannot both take the same
 * row, and it reclaims a `delivering` row whose lease has expired rather than
 * leaving it stranded after a restart.
 */
export async function deliverWriteback(
	writebackId: string,
	transport: WritebackTransport,
	now = new Date(),
): Promise<"claimed" | "skipped"> {
	const leaseCutoff = new Date(now.getTime() - DELIVERY_LEASE_MS);
	const [claimed] = await db
		.update(itsmWritebacks)
		.set({
			status: "delivering",
			claimedAt: now,
			attemptCount: sql`${itsmWritebacks.attemptCount} + 1`,
		})
		.where(
			and(
				eq(itsmWritebacks.id, writebackId),
				sql`${itsmWritebacks.attemptCount} < ${itsmWritebacks.maxAttempts}`,
				or(
					and(
						inArray(itsmWritebacks.status, ["pending", "retrying"]),
						or(
							isNull(itsmWritebacks.nextAttemptAt),
							lte(itsmWritebacks.nextAttemptAt, now),
						),
					),
					and(
						eq(itsmWritebacks.status, "delivering"),
						lte(itsmWritebacks.claimedAt, leaseCutoff),
					),
				),
			),
		)
		.returning({
			id: itsmWritebacks.id,
			ticketId: itsmWritebacks.ticketId,
			payload: itsmWritebacks.payload,
			attemptCount: itsmWritebacks.attemptCount,
			maxAttempts: itsmWritebacks.maxAttempts,
		});
	if (!claimed) return "skipped";

	const payload = claimed.payload as {
		note: string;
		externalId: string;
		correlationId: string | null;
	};

	let failure: string | null = null;
	let receiptId: string | null = null;
	let foreignUpdatedAt: string | null = null;
	try {
		const result = await transport.postWorkNote({
			externalId: payload.externalId,
			note: payload.note,
			correlationId: payload.correlationId ?? undefined,
		});
		receiptId = result.receiptId;
		foreignUpdatedAt = result.updatedAt;
	} catch (error) {
		failure = error instanceof Error ? error.message : String(error);
	}

	const outcome = writebackOutcome(
		claimed.attemptCount,
		claimed.maxAttempts,
		failure !== null,
		now,
	);

	await db
		.update(itsmWritebacks)
		.set({
			status: outcome.status,
			nextAttemptAt: outcome.nextAttemptAt,
			completedAt: outcome.completedAt,
			lastError: failure,
			externalReceiptId: receiptId,
		})
		.where(
			and(
				eq(itsmWritebacks.id, claimed.id),
				eq(itsmWritebacks.status, "delivering"),
			),
		);

	// Record the foreign timestamp our own write produced, so the next poll
	// recognises the resulting change as an echo rather than as the customer
	// having done something.
	if (foreignUpdatedAt)
		await db
			.update(itsmTicketOrigins)
			.set({ lastWrittenAt: new Date(foreignUpdatedAt) })
			.where(eq(itsmTicketOrigins.ticketId, claimed.ticketId));

	return "claimed";
}

/**
 * Sweeps due write-backs. Serialized behind a promise chain so two ticks
 * cannot interleave, matching `sweepWebhookDeliveries`.
 */
let sweepQueue: Promise<unknown> = Promise.resolve();

export async function sweepWritebacks(
	transportFor: (connectorId: string) => Promise<WritebackTransport | null>,
	limit = 25,
	now = new Date(),
): Promise<string[]> {
	const run = sweepQueue.then(async () => {
		const due = await db
			.select({
				id: itsmWritebacks.id,
				connectorId: itsmWritebacks.connectorId,
			})
			.from(itsmWritebacks)
			.innerJoin(
				itsmConnectors,
				eq(itsmConnectors.id, itsmWritebacks.connectorId),
			)
			.where(
				and(
					eq(itsmConnectors.enabled, true),
					inArray(itsmWritebacks.status, ["pending", "retrying"]),
					or(
						isNull(itsmWritebacks.nextAttemptAt),
						lte(itsmWritebacks.nextAttemptAt, now),
					),
				),
			)
			.limit(Math.min(Math.max(limit, 1), 100));

		const delivered: string[] = [];
		for (const row of due) {
			const transport = await transportFor(row.connectorId);
			if (!transport) continue;
			const result = await deliverWriteback(row.id, transport, now);
			if (result === "claimed") delivered.push(row.id);
		}
		return delivered;
	});
	sweepQueue = run.then(
		() => undefined,
		() => undefined,
	);
	return run;
}
