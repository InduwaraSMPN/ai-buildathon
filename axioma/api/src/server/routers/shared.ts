import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
	agentRuns,
	approvals,
	messagingThreads,
	ticketMailOrigins,
	tickets,
	ticketTransitions,
} from "@/db/schema";
import { grpcGateway } from "../grpc";
import { healthProcedure } from "../orpc";
import { canRerun, resolveTicketStatus, ticketRunOrigin } from "../tickets";
import { readContextForTicket } from "../tools/cmdb";
import type { findTicket } from "./tickets";

export const sharedRouter = {
	healthCheck: healthProcedure.healthCheck.handler(() => "OK"),
};

export async function startTicketRun(
	ticket: Awaited<ReturnType<typeof findTicket>>,
) {
	if (!ticket) throw new ORPCError("NOT_FOUND");
	const ticketId = ticket.id;
	const approval = (
		await db
			.select({ status: approvals.status })
			.from(approvals)
			.where(eq(approvals.ticketId, ticketId))
			.orderBy(desc(approvals.requestedAt))
			.limit(1)
	)[0];
	if (
		approval?.status === "waiting_for_approval" ||
		approval?.status === "rejected"
	)
		throw new ORPCError("CONFLICT", {
			message:
				approval.status === "rejected"
					? "This request was not approved"
					: "This request is waiting for approval",
		});
	if (
		(
			await db
				.select({ id: agentRuns.id })
				.from(agentRuns)
				.where(
					and(
						eq(agentRuns.ticketId, ticketId),
						eq(agentRuns.status, "running"),
					),
				)
				.limit(1)
		)[0]
	)
		throw new ORPCError("CONFLICT", {
			message: "Ticket already has a running run",
		});
	if (!grpcGateway.hasWorker())
		throw new ORPCError("SERVICE_UNAVAILABLE", {
			message: "Axel is not connected",
		});
	let nextStatus: typeof ticket.status;
	if (ticket.status === "escalated") {
		const previous = (
			await db
				.select({ status: agentRuns.status })
				.from(agentRuns)
				.where(eq(agentRuns.ticketId, ticketId))
				.orderBy(desc(agentRuns.startedAt))
				.limit(1)
		)[0];
		if (!canRerun(ticket.status, previous?.status))
			throw new ORPCError("CONFLICT", {
				message: "Only failed or exhausted runs can be rerun",
			});
		nextStatus = "routing" as const;
	} else {
		nextStatus = await resolveTicketStatus(ticket.status, "startRun");
	}
	const [mailOrigin, channelOrigin] = await Promise.all([
		db
			.select({ origin: ticketMailOrigins.ticketOrigin })
			.from(ticketMailOrigins)
			.where(eq(ticketMailOrigins.ticketId, ticketId))
			.limit(1),
		db
			.select({ origin: messagingThreads.originKey })
			.from(messagingThreads)
			.where(eq(messagingThreads.ticketId, ticketId))
			.orderBy(desc(messagingThreads.openedAt))
			.limit(1),
	]);
	const origin = ticketRunOrigin(
		mailOrigin[0]?.origin,
		channelOrigin[0]?.origin,
	);
	const runId = crypto.randomUUID();
	await db.transaction(async (tx) => {
		const changed = await tx
			.update(tickets)
			.set({
				status: nextStatus,
				progressMarker: "gathering_evidence",
				updatedAt: new Date(),
			})
			.where(and(eq(tickets.id, ticketId), eq(tickets.status, ticket.status)))
			.returning({ id: tickets.id });
		if (!changed[0])
			throw new ORPCError("CONFLICT", {
				message: "Ticket changed while run was starting",
			});
		await tx.insert(agentRuns).values({ id: runId, ticketId });
		await tx.insert(ticketTransitions).values({
			id: crypto.randomUUID(),
			ticketId,
			fromStatus: ticket.status,
			toStatus: nextStatus,
			action: "startRun",
			actorType: "agent",
			actorId: runId,
		});
	});
	try {
		await grpcGateway.startRun({
			runId,
			ticketId,
			title: ticket.title,
			body: ticket.body,
			reporterId: ticket.reporterId,
			deviceId: ticket.deviceId ?? undefined,
			contextJson: JSON.stringify(
				await readContextForTicket(ticket.id, ticket.deviceId),
			),
			recordType: ticket.recordType,
			impact: ticket.impact,
			urgency: ticket.urgency,
			priority: ticket.priority,
			origin,
		});
	} catch (error) {
		await db.transaction(async (tx) => {
			await tx
				.update(agentRuns)
				.set({
					status: "failed",
					outcome: "agent dispatch failed",
					endedAt: new Date(),
				})
				.where(and(eq(agentRuns.id, runId), eq(agentRuns.status, "running")));
			await tx
				.update(tickets)
				.set({
					status: ticket.status,
					progressMarker: ticket.progressMarker,
					updatedAt: new Date(),
				})
				.where(and(eq(tickets.id, ticketId), eq(tickets.status, "routing")));
		});
		throw new ORPCError("SERVICE_UNAVAILABLE", {
			message: error instanceof Error ? error.message : "Axel is not connected",
		});
	}
	const run = (
		await db.select().from(agentRuns).where(eq(agentRuns.id, runId)).limit(1)
	)[0];
	if (!run) throw new ORPCError("INTERNAL_SERVER_ERROR");
	return run;
}
