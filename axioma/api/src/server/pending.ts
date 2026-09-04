import { and, asc, eq, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
	pendingFollowups,
	pendingReasons,
	ticketMessages,
	ticketStatuses,
	tickets,
	ticketTransitions,
} from "@/db/schema";
import { transitionTicketStopwatches } from "./sla/runtime";
import { resolveTicketStatus } from "./tickets";

export const nextPendingFollowupAt = (
	lastPendingAt: Date,
	frequencyMinutes: number,
) => new Date(lastPendingAt.getTime() + frequencyMinutes * 60_000);

export async function sweepPending(
	now = new Date(),
	limit = 100,
): Promise<number> {
	const due = await db
		.select({ ticket: tickets, reason: pendingReasons })
		.from(tickets)
		.innerJoin(pendingReasons, eq(tickets.pendingReasonId, pendingReasons.id))
		.innerJoin(ticketStatuses, eq(tickets.status, ticketStatuses.key))
		.where(
			and(
				eq(ticketStatuses.stateType, "pending"),
				lte(tickets.pendingUntil, now),
			),
		)
		.orderBy(asc(tickets.pendingUntil), asc(tickets.id))
		.limit(Math.min(Math.max(limit, 1), 1_000));
	let changed = 0;
	for (const { ticket, reason } of due) {
		const ordinal = ticket.pendingFollowups + 1;
		if (ordinal > reason.followupsBeforeResolution) {
			const resolvedStatus = await resolveTicketStatus(
				ticket.status,
				"resolve",
			);
			const resolved = await db.transaction(async (tx) => {
				const resolved = await tx
					.update(tickets)
					.set({
						status: resolvedStatus,
						resolution: `Auto-resolved after ${ticket.pendingFollowups} unanswered follow-ups`,
						resolutionCode: "no_action_required",
						resolvedAt: now,
						pendingReasonId: null,
						pendingUntil: null,
						updatedAt: now,
					})
					.where(
						and(eq(tickets.id, ticket.id), eq(tickets.status, ticket.status)),
					)
					.returning({ id: tickets.id });
				if (!resolved[0]) return false;
				await tx.insert(ticketTransitions).values({
					id: crypto.randomUUID(),
					ticketId: ticket.id,
					fromStatus: ticket.status,
					toStatus: resolvedStatus,
					action: "resolve",
					actorType: "agent",
					actorId: "pending-sweep",
				});
				await transitionTicketStopwatches(ticket.id, resolvedStatus, now, tx);
				return true;
			});
			if (resolved) changed++;
			continue;
		}
		// The cadence runs from the slot that came due rather than from the moment
		// the sweep noticed it, so a late tick cannot push every later follow-up out
		// by its own lateness. Whole periods are skipped to stay ahead of `now`.
		let pendingUntil = nextPendingFollowupAt(
			ticket.pendingUntil ?? now,
			reason.followupFrequencyMinutes,
		);
		if (pendingUntil <= now) {
			const frequencyMs = reason.followupFrequencyMinutes * 60_000;
			const missed = Math.ceil(
				(now.getTime() - pendingUntil.getTime() + 1) / frequencyMs,
			);
			pendingUntil = new Date(pendingUntil.getTime() + missed * frequencyMs);
		}
		const followedUp = await db.transaction(async (tx) => {
			const followedUp = await tx
				.update(tickets)
				.set({
					pendingFollowups: sql`${tickets.pendingFollowups} + 1`,
					pendingUntil,
					updatedAt: now,
				})
				.where(
					and(
						eq(tickets.id, ticket.id),
						eq(tickets.status, ticket.status),
						eq(tickets.pendingFollowups, ticket.pendingFollowups),
					),
				)
				.returning({ id: tickets.id });
			if (!followedUp[0]) return false;
			await tx.insert(pendingFollowups).values({
				id: crypto.randomUUID(),
				ticketId: ticket.id,
				reasonId: reason.id,
				ordinal,
			});
			await tx.insert(ticketMessages).values({
				id: crypto.randomUUID(),
				ticketId: ticket.id,
				authorId: null,
				authorType: "staff",
				body: "We’re still waiting for the information needed to continue.",
				visibility: "public",
			});
			return true;
		});
		if (followedUp) changed++;
	}
	return changed;
}
