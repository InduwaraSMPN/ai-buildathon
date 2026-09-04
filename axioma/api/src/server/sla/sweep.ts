import { and, asc, eq, exists, lte, notExists, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
	olas,
	slaEscalationEvents,
	slaNotificationRules,
	slas,
	ticketStopwatches,
	tickets,
} from "@/db/schema";
import { fireEvent } from "../workflows/runtime";
import { elapsedWorkingMs } from "./calendar";

/**
 * Every rule this watch could still fire, correlated to the outer stopwatch row.
 * A watch with none left is fully escalated: it can never mark anything again, so
 * the sweep must not let it hold a slot in the oldest-first window forever.
 */
const unfiredRule = db
	.select({ id: slaNotificationRules.id })
	.from(slaNotificationRules)
	.where(
		and(
			eq(slaNotificationRules.policyType, ticketStopwatches.policyType),
			eq(slaNotificationRules.policyId, ticketStopwatches.policyId),
			eq(slaNotificationRules.enabled, true),
			or(
				eq(slaNotificationRules.targetType, ticketStopwatches.targetType),
				eq(slaNotificationRules.targetType, "both"),
			),
			notExists(
				db
					.select({ id: slaEscalationEvents.id })
					.from(slaEscalationEvents)
					.where(
						and(
							eq(slaEscalationEvents.stopwatchId, ticketStopwatches.id),
							eq(slaEscalationEvents.ruleId, slaNotificationRules.id),
						),
					),
			),
		),
	);

/** Marks each threshold once; the unique event key makes restarts and concurrent sweeps safe. */
export async function sweepSla(now = new Date(), limit = 100): Promise<number> {
	const watches = await db
		.select()
		.from(ticketStopwatches)
		.where(and(eq(ticketStopwatches.running, true), exists(unfiredRule)))
		.orderBy(asc(ticketStopwatches.startedAt), asc(ticketStopwatches.id))
		.limit(Math.min(Math.max(limit, 1), 1_000));
	let marked = 0;
	for (const watch of watches) {
		try {
			marked += (await markWatch(watch, now)) ? 1 : 0;
		} catch (error) {
			console.error(`[sla] stopwatch ${watch.id} sweep failed`, error);
		}
	}
	return marked;
}

async function markWatch(
	watch: typeof ticketStopwatches.$inferSelect,
	now: Date,
): Promise<boolean> {
	const table = watch.policyType === "sla" ? slas : olas;
	const policy = (
		await db.select().from(table).where(eq(table.id, watch.policyId)).limit(1)
	)[0];
	if (!policy) return false;
	const elapsed =
		watch.accumulatedMs +
		(await elapsedWorkingMs(watch.startedAt, now, policy.calendarId));
	const targetMs =
		(watch.targetType === "response"
			? policy.ttoWorkingMinutes
			: policy.ttrWorkingMinutes) * 60_000;
	const rules = await db
		.select()
		.from(slaNotificationRules)
		.where(
			and(
				eq(slaNotificationRules.policyType, watch.policyType),
				eq(slaNotificationRules.policyId, watch.policyId),
				eq(slaNotificationRules.enabled, true),
			),
		);
	const rule = rules
		.filter(
			(candidate) =>
				(candidate.targetType === watch.targetType ||
					candidate.targetType === "both") &&
				elapsed >= targetMs * (candidate.thresholdPercent / 100),
		)
		.sort((a, b) => b.thresholdPercent - a.thresholdPercent)[0];
	if (!rule) return false;
	const triggerType = rule.triggerType;
	const idempotencyKey = `${watch.id}:${rule.id}`;
	const reason = `${watch.policyType.toUpperCase()} ${watch.targetType} target ${triggerType === "breach" ? "missed" : "at risk"}`;
	const inserted = await db.transaction(async (tx) => {
		const inserted = await tx
			.insert(slaEscalationEvents)
			.values({
				id: crypto.randomUUID(),
				idempotencyKey,
				ticketId: watch.ticketId,
				stopwatchId: watch.id,
				ruleId: rule.id,
				triggerType,
				targetType: watch.targetType,
				reason,
			})
			.onConflictDoNothing({ target: slaEscalationEvents.idempotencyKey })
			.returning({ id: slaEscalationEvents.id });
		if (!inserted.length) return false;
		await tx
			.update(tickets)
			.set({ escalationFlag: triggerType, escalationReason: reason })
			.where(
				triggerType === "breach"
					? eq(tickets.id, watch.ticketId)
					: and(
							eq(tickets.id, watch.ticketId),
							sql`${tickets.escalationFlag} <> 'breach'`,
						),
			);
		return true;
	});
	if (!inserted) return false;
	// Webhook delivery is left queued for `sweepWebhookDeliveries`: an endpoint that
	// blackholes requests would otherwise stall the whole tick ten seconds a row.
	await fireEvent({
		type: `sla.${triggerType}`,
		source: "sla",
		recordType: "ticket",
		recordId: watch.ticketId,
		payload: {
			policyType: watch.policyType,
			targetType: watch.targetType,
			reason,
		},
		queueWebhooks: true,
	});
	return true;
}

export async function sweepPresence(now = new Date()): Promise<void> {
	const { ticketPresence } = await import("@/db/schema");
	await db.delete(ticketPresence).where(lte(ticketPresence.expiresAt, now));
}
