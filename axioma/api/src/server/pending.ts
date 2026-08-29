import { and, eq, lte, sql } from "drizzle-orm";

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

export async function sweepPending(now = new Date()): Promise<number> {
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
		);
	let changed = 0;
	for (const { ticket, reason } of due) {
		const ordinal = ticket.pendingFollowups + 1;
		if (ordinal > reason.followupsBeforeResolution) {
			const resolvedStatus = await resolveTicketStatus(
				ticket.status,
				"resolve",
			);
			const resolved = await db
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
			if (resolved[0]) {
				await db.insert(ticketTransitions).values({
					id: crypto.randomUUID(),
					ticketId: ticket.id,
					fromStatus: ticket.status,
					toStatus: resolvedStatus,
					action: "resolve",
					actorType: "agent",
					actorId: "pending-sweep",
				});
				await transitionTicketStopwatches(ticket.id, resolvedStatus, now);
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
					eq(tickets.status, ticket.status),
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
		await db.insert(ticketMessages).values({
			id: crypto.randomUUID(),
			ticketId: ticket.id,
			authorId: null,
			authorType: "staff",
			body: "We’re still waiting for the information needed to continue.",
			visibility: "public",
		});
		changed++;
	}
	return changed;
}
