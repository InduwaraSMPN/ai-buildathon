import { and, eq, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
	pendingFollowups,
	pendingReasons,
	tickets,
	ticketTransitions,
} from "@/db/schema";
import { transitionTicketStopwatches } from "./sla/runtime";

export const nextPendingFollowupAt = (
	lastPendingAt: Date,
	frequencyMinutes: number,
) => new Date(lastPendingAt.getTime() + frequencyMinutes * 60_000);

export async function sweepPending(now = new Date()): Promise<number> {
	const due = await db
		.select({ ticket: tickets, reason: pendingReasons })
		.from(tickets)
		.innerJoin(pendingReasons, eq(tickets.pendingReasonId, pendingReasons.id))
		.where(and(eq(tickets.status, "pending"), lte(tickets.pendingUntil, now)));
	let changed = 0;
	for (const { ticket, reason } of due) {
		const ordinal = ticket.pendingFollowups + 1;
		if (ordinal > reason.followupsBeforeResolution) {
			const resolved = await db
				.update(tickets)
				.set({
					status: "resolved",
					resolution: `Auto-resolved after ${ticket.pendingFollowups} unanswered follow-ups`,
					resolutionCode: "no_action_required",
					resolvedAt: now,
					pendingReasonId: null,
					pendingUntil: null,
					updatedAt: now,
				})
				.where(and(eq(tickets.id, ticket.id), eq(tickets.status, "pending")))
				.returning({ id: tickets.id });
			if (resolved[0]) {
				await db.insert(ticketTransitions).values({
					id: crypto.randomUUID(),
					ticketId: ticket.id,
					fromStatus: "pending",
					toStatus: "resolved",
					action: "resolve",
					actorType: "agent",
					actorId: "pending-sweep",
				});
				await transitionTicketStopwatches(ticket.id, "resolved", now);
				changed++;
			}
			continue;
		}
		const followedUp = await db
			.update(tickets)
			.set({
				pendingFollowups: sql`${tickets.pendingFollowups} + 1`,
				pendingUntil: nextPendingFollowupAt(
					now,
					reason.followupFrequencyMinutes,
				),
				updatedAt: now,
			})
			.where(
				and(
					eq(tickets.id, ticket.id),
					eq(tickets.status, "pending"),
					eq(tickets.pendingFollowups, ticket.pendingFollowups),
				),
			)
			.returning({ id: tickets.id });
		if (!followedUp[0]) continue;
		await db.insert(pendingFollowups).values({
			id: crypto.randomUUID(),
			ticketId: ticket.id,
			reasonId: reason.id,
			ordinal,
		});
		changed++;
	}
	return changed;
}
