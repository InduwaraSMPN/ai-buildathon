import { ORPCError, type RouterClient } from "@orpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps, devices, tickets, user } from "@/db/schema";
import { protectedProcedure, publicProcedure } from "../orpc";

const ticketSelection = {
	id: tickets.id,
	reporterId: tickets.reporterId,
	reporterName: user.name,
	deviceId: tickets.deviceId,
	title: tickets.title,
	body: tickets.body,
	status: tickets.status,
	route: tickets.route,
	resolution: tickets.resolution,
	createdAt: tickets.createdAt,
	updatedAt: tickets.updatedAt,
	closedAt: tickets.closedAt,
};

async function findTicket(id: string) {
	return (
		await db
			.select(ticketSelection)
			.from(tickets)
			.innerJoin(user, eq(tickets.reporterId, user.id))
			.where(eq(tickets.id, id))
			.limit(1)
	)[0];
}

export const appRouter = {
	healthCheck: publicProcedure.healthCheck.handler(() => "OK"),

	privateData: protectedProcedure.privateData.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),

	createTicket: protectedProcedure.createTicket.handler(
		async ({ context, input }) => {
			const id = crypto.randomUUID();
			await db.insert(tickets).values({
				id,
				reporterId: context.session.user.id,
				deviceId: input.deviceId,
				title: input.title,
				body: input.body,
			});
			const created = await findTicket(id);
			if (!created) throw new ORPCError("INTERNAL_SERVER_ERROR");
			return created;
		},
	),

	listTickets: protectedProcedure.listTickets.handler(
		async ({ context, input }) => {
			const conditions = [
				input.scope === "mine"
					? eq(tickets.reporterId, context.session.user.id)
					: undefined,
				input.status ? eq(tickets.status, input.status) : undefined,
			].filter((condition) => condition !== undefined);

			return db
				.select(ticketSelection)
				.from(tickets)
				.innerJoin(user, eq(tickets.reporterId, user.id))
				.where(conditions.length ? and(...conditions) : undefined)
				.orderBy(desc(tickets.updatedAt));
		},
	),

	getTicket: protectedProcedure.getTicket.handler(async ({ input }) => {
		const ticket = await findTicket(input.id);
		if (!ticket) return null;

		const runs = await db
			.select()
			.from(agentRuns)
			.where(eq(agentRuns.ticketId, input.id))
			.orderBy(desc(agentRuns.startedAt));
		const steps = await db
			.select()
			.from(agentSteps)
			.innerJoin(agentRuns, eq(agentSteps.runId, agentRuns.id))
			.where(eq(agentRuns.ticketId, input.id))
			.orderBy(asc(agentSteps.ordinal));

		return {
			...ticket,
			runs: runs.map((run) => ({
				...run,
				steps: steps
					.filter(({ agent_steps }) => agent_steps.runId === run.id)
					.map(({ agent_steps }) => agent_steps),
			})),
		};
	}),

	updateTicket: protectedProcedure.updateTicket.handler(async ({ input }) => {
		const now = new Date();
		await db
			.update(tickets)
			.set({
				status: input.action === "close" ? "closed" : "escalated",
				resolution: input.resolution,
				route: input.route,
				closedAt: input.action === "close" ? now : null,
				updatedAt: now,
			})
			.where(eq(tickets.id, input.id));
		const updated = await findTicket(input.id);
		if (!updated) throw new ORPCError("NOT_FOUND");
		return updated;
	}),

	listDevices: protectedProcedure.listDevices.handler(() =>
		db
			.select({
				id: devices.id,
				ownerId: devices.ownerId,
				ownerName: user.name,
				hostname: devices.hostname,
				username: devices.username,
				platform: devices.platform,
				release: devices.release,
				agentVersion: devices.agentVersion,
				connected: devices.connected,
				lastSeenAt: devices.lastSeenAt,
				enrolledAt: devices.enrolledAt,
			})
			.from(devices)
			.leftJoin(user, eq(devices.ownerId, user.id))
			.orderBy(desc(devices.lastSeenAt)),
	),
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
