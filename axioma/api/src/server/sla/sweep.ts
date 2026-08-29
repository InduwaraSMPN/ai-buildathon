import { and, eq, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
	olas,
	slaEscalationEvents,
	slas,
	ticketStopwatches,
	tickets,
} from "@/db/schema";
import { fireEvent } from "../workflows/runtime";
import { elapsedWorkingMs } from "./calendar";

/** Marks each threshold once; the unique event key makes restarts and concurrent sweeps safe. */
export async function sweepSla(now = new Date()): Promise<number> {
	const watches = await db
		.select()
		.from(ticketStopwatches)
		.where(eq(ticketStopwatches.running, true));
	let marked = 0;
	for (const watch of watches) {
		const table = watch.policyType === "sla" ? slas : olas;
		const policy = (
			await db.select().from(table).where(eq(table.id, watch.policyId)).limit(1)
		)[0];
		if (!policy) continue;
		const elapsed =
			watch.accumulatedMs +
			(await elapsedWorkingMs(watch.startedAt, now, policy.calendarId));
		const targetMs =
			(watch.targetType === "response"
				? policy.ttoWorkingMinutes
				: policy.ttrWorkingMinutes) * 60_000;
		const triggerType =
			elapsed >= targetMs
				? "breach"
				: elapsed >= targetMs * 0.8
					? "warning"
					: null;
		if (!triggerType) continue;
		const idempotencyKey = `${watch.id}:${triggerType}`;
		const inserted = await db
			.insert(slaEscalationEvents)
			.values({
				id: crypto.randomUUID(),
				idempotencyKey,
				ticketId: watch.ticketId,
				stopwatchId: watch.id,
				triggerType,
				targetType: watch.targetType,
				reason: `${watch.policyType.toUpperCase()} ${watch.targetType} target ${triggerType === "breach" ? "missed" : "at risk"}`,
			})
			.onConflictDoNothing({ target: slaEscalationEvents.idempotencyKey })
			.returning({ id: slaEscalationEvents.id });
		if (!inserted.length) continue;
		const reason = `${watch.policyType.toUpperCase()} ${watch.targetType} target ${triggerType === "breach" ? "missed" : "at risk"}`;
		await db
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
		});
		marked++;
	}
	return marked;
}

export async function sweepPresence(now = new Date()): Promise<void> {
	const { ticketPresence } = await import("@/db/schema");
	await db.delete(ticketPresence).where(lte(ticketPresence.expiresAt, now));
}
