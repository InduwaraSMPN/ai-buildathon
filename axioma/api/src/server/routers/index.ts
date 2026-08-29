import { ORPCError, type RouterClient } from "@orpc/server";
import {
	and,
	asc,
	count,
	countDistinct,
	desc,
	eq,
	gt,
	gte,
	ilike,
	inArray,
	lt,
	or,
	sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
	agentRuns,
	agentSteps,
	deviceCommands,
	devices,
	tickets,
	ticketTransitions,
	user,
} from "@/db/schema";
import { env } from "@/env";
import {
	CATEGORY_NAMES,
	derivePriority,
	PRIORITIES,
	RECORD_TYPES,
	TICKET_ROUTES,
	TICKET_STATUSES,
} from "@/shared";
import { grpcGateway } from "../grpc";
import { protectedProcedure, publicProcedure } from "../orpc";
import { canRerun, nextTicketStatus, preserveUndefined } from "../tickets";
import { readContextForTicket } from "../tools/cmdb";

const ticketSelection = {
	id: tickets.id,
	reporterId: tickets.reporterId,
	reporterName: user.name,
	deviceId: tickets.deviceId,
	title: tickets.title,
	body: tickets.body,
	recordType: tickets.recordType,
	impact: tickets.impact,
	urgency: tickets.urgency,
	priority: tickets.priority,
	category: tickets.category,
	subcategory: tickets.subcategory,
	status: tickets.status,
	route: tickets.route,
	resolution: tickets.resolution,
	escalationNote: tickets.escalationNote,
	reporterNote: tickets.reporterNote,
	progressMarker: tickets.progressMarker,
	createdAt: tickets.createdAt,
	updatedAt: tickets.updatedAt,
	resolvedAt: tickets.resolvedAt,
	closedAt: tickets.closedAt,
	reopenedAt: tickets.reopenedAt,
};

async function findTicket(id: string, reporterId?: string) {
	return (
		await db
			.select(ticketSelection)
			.from(tickets)
			.innerJoin(user, eq(tickets.reporterId, user.id))
			.where(
				reporterId
					? and(eq(tickets.id, id), eq(tickets.reporterId, reporterId))
					: eq(tickets.id, id),
			)
			.limit(1)
	)[0];
}
const encodeCursor = (value: string | Date, updatedAt: Date, id: string) =>
	Buffer.from(
		JSON.stringify([
			value instanceof Date ? value.toISOString() : value,
			updatedAt.toISOString(),
			id,
		]),
	).toString("base64url");
function decodeCursor(cursor: string): [string, string, string] {
	try {
		const value: unknown = JSON.parse(
			Buffer.from(cursor, "base64url").toString(),
		);
		if (
			Array.isArray(value) &&
			value.length === 3 &&
			value.every((item) => typeof item === "string")
		)
			return value as [string, string, string];
	} catch {}
	throw new ORPCError("BAD_REQUEST", { message: "Invalid ticket cursor" });
}
async function getRun(id: string) {
	const run = (
		await db.select().from(agentRuns).where(eq(agentRuns.id, id)).limit(1)
	)[0];
	if (!run) return null;
	return {
		...run,
		steps: await db
			.select()
			.from(agentSteps)
			.where(eq(agentSteps.runId, id))
			.orderBy(asc(agentSteps.ordinal)),
	};
}
async function startTicketRun(ticketId: string) {
	const ticket = await findTicket(ticketId);
	if (!ticket) throw new ORPCError("NOT_FOUND");
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
		nextStatus = nextTicketStatus(ticket.status, "startRun");
	}
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

export const appRouter = {
	healthCheck: publicProcedure.healthCheck.handler(() => "OK"),
	privateData: protectedProcedure.privateData.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
	createTicket: protectedProcedure.createTicket.handler(
		async ({ context, input }) => {
			let deviceId = input.deviceId;
			if (deviceId) {
				if (
					!(
						await db
							.select({ id: devices.id })
							.from(devices)
							.where(
								and(
									eq(devices.id, deviceId),
									eq(devices.ownerId, context.session.user.id),
								),
							)
							.limit(1)
					)[0]
				)
					throw new ORPCError("NOT_FOUND");
			} else {
				deviceId = (
					await db
						.select({ id: devices.id })
						.from(devices)
						.where(eq(devices.ownerId, context.session.user.id))
						.orderBy(desc(devices.lastSeenAt))
						.limit(1)
				)[0]?.id;
			}
			const id = crypto.randomUUID();
			await db.insert(tickets).values({
				id,
				reporterId: context.session.user.id,
				deviceId,
				title: input.title,
				body: input.body,
				recordType: input.recordType,
				impact: input.impact,
				urgency: input.urgency,
				priority: derivePriority(input.impact, input.urgency),
			});
			let created = await findTicket(id);
			if (!created) throw new ORPCError("INTERNAL_SERVER_ERROR");
			if (env.AXIOMA_AUTO_DISPATCH && grpcGateway.hasWorker()) {
				await startTicketRun(id);
				created = await findTicket(id);
				if (!created) throw new ORPCError("INTERNAL_SERVER_ERROR");
			}
			return created;
		},
	),
	listTickets: protectedProcedure.listTickets.handler(
		async ({ context, input }) => {
			const filters = [
				input.scope === "mine"
					? eq(tickets.reporterId, context.session.user.id)
					: undefined,
				input.status?.length
					? inArray(tickets.status, input.status)
					: undefined,
				input.priority?.length
					? inArray(tickets.priority, input.priority)
					: undefined,
				input.recordType?.length
					? inArray(tickets.recordType, input.recordType)
					: undefined,
				input.category?.length
					? or(
							input.category.some((value) => value === null)
								? sql`${tickets.category} is null`
								: undefined,
							input.category.some((value) => value !== null)
								? inArray(
										tickets.category,
										input.category.filter(
											(value): value is NonNullable<typeof value> =>
												value !== null,
										),
									)
								: undefined,
						)
					: undefined,
				input.route?.length
					? or(
							input.route.some((value) => value === null)
								? sql`${tickets.route} is null`
								: undefined,
							input.route.some((value) => value !== null)
								? inArray(
										tickets.route,
										input.route.filter(
											(value): value is NonNullable<typeof value> =>
												value !== null,
										),
									)
								: undefined,
						)
					: undefined,
				input.deviceId ? eq(tickets.deviceId, input.deviceId) : undefined,
				input.unassigned
					? sql`${tickets.route} is null or ${tickets.route} = 'unassigned'`
					: undefined,
				input.escalatedSince
					? sql`exists (
						select 1 from ${ticketTransitions}
						where ${ticketTransitions.ticketId} = ${tickets.id}
							and ${ticketTransitions.toStatus} = 'escalated'
							and ${ticketTransitions.createdAt} >= ${input.escalatedSince}
					)`
					: undefined,
				input.resolvedAt ? sql`${tickets.resolvedAt} is not null` : undefined,
				input.autonomous
					? sql`not exists (
						select 1 from ${ticketTransitions}
						where ${ticketTransitions.ticketId} = ${tickets.id}
							and ${ticketTransitions.actorType} = 'human'
					)`
					: undefined,
				input.search
					? or(
							ilike(tickets.title, `%${input.search}%`),
							ilike(tickets.id, `%${input.search}%`),
							ilike(user.name, `%${input.search}%`),
						)
					: undefined,
			].filter((condition) => condition !== undefined);
			const direction = input.sortDirection === "asc" ? asc : desc;
			const sortColumn =
				input.sortBy === "updatedAt"
					? tickets.updatedAt
					: input.sortBy === "createdAt"
						? tickets.createdAt
						: tickets.priority;
			const cursor = input.cursor ? decodeCursor(input.cursor) : undefined;
			const cursorFilter = !cursor
				? undefined
				: input.sortBy === "priority"
					? (() => {
							const priority = cursor[0] as (typeof PRIORITIES)[number];
							const updatedAt = new Date(cursor[1]);
							if (
								!PRIORITIES.includes(priority) ||
								Number.isNaN(updatedAt.getTime())
							)
								throw new ORPCError("BAD_REQUEST", {
									message: "Invalid ticket cursor",
								});
							return input.sortDirection === "asc"
								? or(
										gt(tickets.priority, priority),
										and(
											eq(tickets.priority, priority),
											or(
												lt(tickets.updatedAt, updatedAt),
												and(
													eq(tickets.updatedAt, updatedAt),
													gt(tickets.id, cursor[2]),
												),
											),
										),
									)
								: or(
										lt(tickets.priority, priority),
										and(
											eq(tickets.priority, priority),
											or(
												lt(tickets.updatedAt, updatedAt),
												and(
													eq(tickets.updatedAt, updatedAt),
													gt(tickets.id, cursor[2]),
												),
											),
										),
									);
						})()
					: (() => {
							const value = new Date(cursor[0]);
							if (Number.isNaN(value.getTime()))
								throw new ORPCError("BAD_REQUEST", {
									message: "Invalid ticket cursor",
								});
							const column =
								input.sortBy === "createdAt"
									? tickets.createdAt
									: tickets.updatedAt;
							return or(
								input.sortDirection === "asc"
									? gt(column, value)
									: lt(column, value),
								and(eq(column, value), gt(tickets.id, cursor[2])),
							);
						})();
			const rows = await db
				.select(ticketSelection)
				.from(tickets)
				.innerJoin(user, eq(tickets.reporterId, user.id))
				.where(and(...filters, cursorFilter))
				.orderBy(
					...(input.sortBy === "priority"
						? [
								direction(tickets.priority),
								desc(tickets.updatedAt),
								asc(tickets.id),
							]
						: [direction(sortColumn), asc(tickets.id)]),
				)
				.limit(input.limit + 1);
			const items = rows.slice(0, input.limit);
			const last = items.at(-1);
			const nextCursor =
				rows.length > input.limit && last
					? encodeCursor(
							input.sortBy === "priority"
								? last.priority
								: input.sortBy === "createdAt"
									? last.createdAt
									: last.updatedAt,
							last.updatedAt,
							last.id,
						)
					: null;
			const scope =
				input.scope === "mine"
					? eq(tickets.reporterId, context.session.user.id)
					: undefined;
			const [statuses, priorities, recordTypes, categories, routes] =
				await Promise.all([
					db
						.select({ value: tickets.status, count: count() })
						.from(tickets)
						.where(scope)
						.groupBy(tickets.status),
					db
						.select({ value: tickets.priority, count: count() })
						.from(tickets)
						.where(scope)
						.groupBy(tickets.priority),
					db
						.select({ value: tickets.recordType, count: count() })
						.from(tickets)
						.where(scope)
						.groupBy(tickets.recordType),
					db
						.select({ value: tickets.category, count: count() })
						.from(tickets)
						.where(scope)
						.groupBy(tickets.category),
					db
						.select({ value: tickets.route, count: count() })
						.from(tickets)
						.where(scope)
						.groupBy(tickets.route),
				]);
			return {
				items,
				nextCursor,
				facets: {
					status: TICKET_STATUSES.map((value) => ({
						value,
						count: statuses.find((row) => row.value === value)?.count ?? 0,
					})),
					priority: PRIORITIES.map((value) => ({
						value,
						count: priorities.find((row) => row.value === value)?.count ?? 0,
					})),
					recordType: RECORD_TYPES.map((value) => ({
						value,
						count: recordTypes.find((row) => row.value === value)?.count ?? 0,
					})),
					category: [...CATEGORY_NAMES, null].map((value) => ({
						value,
						count: categories.find((row) => row.value === value)?.count ?? 0,
					})),
					route: [...TICKET_ROUTES, null].map((value) => ({
						value,
						count: routes.find((row) => row.value === value)?.count ?? 0,
					})),
				},
			};
		},
	),
	getMyTicket: protectedProcedure.getMyTicket.handler(({ context, input }) =>
		findTicket(input.id, context.session.user.id).then(
			(ticket) => ticket ?? null,
		),
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
	getRun: protectedProcedure.getRun.handler(({ input }) => getRun(input.id)),
	startRun: protectedProcedure.startRun.handler(({ input }) =>
		startTicketRun(input.ticketId),
	),
	cancelRun: protectedProcedure.cancelRun.handler(async ({ input }) => {
		const run = (
			await db
				.select()
				.from(agentRuns)
				.where(eq(agentRuns.id, input.id))
				.limit(1)
		)[0];
		if (!run) throw new ORPCError("NOT_FOUND");
		if (run.status !== "running")
			throw new ORPCError("CONFLICT", {
				message: `Cannot cancel run in ${run.status} state`,
			});
		await grpcGateway.cancelRun(input.id, input.reason);
		const updated = (
			await db
				.select()
				.from(agentRuns)
				.where(eq(agentRuns.id, input.id))
				.limit(1)
		)[0];
		if (updated?.status !== "failed")
			throw new ORPCError("CONFLICT", {
				message: "Run changed while it was being cancelled",
			});
		return updated;
	}),
	updateTicket: protectedProcedure.updateTicket.handler(
		async ({ context, input }) => {
			const current = await findTicket(input.id);
			if (!current) throw new ORPCError("NOT_FOUND");
			if (input.action === "resolve" && !input.resolution)
				throw new ORPCError("BAD_REQUEST", {
					message: "resolution is required",
				});
			if (
				(input.action === "escalate" || input.action === "add_detail") &&
				!input.note
			)
				throw new ORPCError("BAD_REQUEST", { message: "note is required" });
			if (
				input.action === "reopen" &&
				(current.reopenedAt ||
					!current.closedAt ||
					Date.now() - current.closedAt.getTime() > 7 * 24 * 60 * 60 * 1000)
			)
				throw new ORPCError("CONFLICT", {
					message: "This request can no longer be reopened",
				});
			if (input.action === "assign" && !input.route)
				throw new ORPCError("BAD_REQUEST", { message: "route is required" });
			const nextStatus = nextTicketStatus(current.status, input.action);
			const impact =
				input.action === "reclassify"
					? (input.impact ?? current.impact)
					: current.impact;
			const urgency =
				input.action === "reclassify"
					? (input.urgency ?? current.urgency)
					: current.urgency;
			const now = new Date();
			const changed = await db
				.update(tickets)
				.set({
					status: nextStatus,
					recordType:
						input.action === "reclassify"
							? preserveUndefined(input.recordType, current.recordType)
							: current.recordType,
					impact,
					urgency,
					priority: derivePriority(impact, urgency),
					category:
						input.action === "reclassify"
							? preserveUndefined(input.category, current.category)
							: current.category,
					subcategory:
						input.action === "reclassify"
							? preserveUndefined(input.subcategory, current.subcategory)
							: current.subcategory,
					route:
						input.action === "assign" || input.action === "escalate"
							? input.route
							: current.route,
					resolution:
						input.action === "resolve" ? input.resolution : current.resolution,
					escalationNote:
						input.action === "escalate" ? input.note : current.escalationNote,
					reporterNote:
						input.action === "add_detail" ? input.note : current.reporterNote,
					progressMarker:
						input.action === "escalate"
							? "handing_to_person"
							: input.action === "reopen"
								? null
								: current.progressMarker,
					resolvedAt:
						input.action === "resolve"
							? now
							: input.action === "reopen"
								? null
								: current.resolvedAt,
					closedAt:
						input.action === "close"
							? now
							: input.action === "reopen"
								? null
								: current.closedAt,
					reopenedAt: input.action === "reopen" ? now : current.reopenedAt,
					lastHumanTransitionAt: now,
					updatedAt: now,
				})
				.where(
					and(eq(tickets.id, input.id), eq(tickets.status, current.status)),
				)
				.returning({ id: tickets.id });
			if (!changed[0])
				throw new ORPCError("CONFLICT", {
					message: "Ticket changed while it was being updated",
				});
			if (nextStatus !== current.status)
				await db.insert(ticketTransitions).values({
					id: crypto.randomUUID(),
					ticketId: input.id,
					fromStatus: current.status,
					toStatus: nextStatus,
					action: input.action,
					actorType: "human",
					actorId: context.session.user.id,
				});
			const updated = await findTicket(input.id);
			if (!updated) throw new ORPCError("NOT_FOUND");
			return updated;
		},
	),
	listMyDevices: protectedProcedure.listMyDevices.handler(({ context }) =>
		db
			.select({
				id: devices.id,
				hostname: devices.hostname,
				connected: devices.connected,
				lastSeenAt: devices.lastSeenAt,
			})
			.from(devices)
			.where(eq(devices.ownerId, context.session.user.id))
			.orderBy(desc(devices.lastSeenAt)),
	),
	enrollDevice: protectedProcedure.enrollDevice.handler(
		async ({ context, input }) => {
			const now = new Date();
			const enrolled = await db
				.update(devices)
				.set({
					ownerId: context.session.user.id,
					enrolmentCode: null,
					enrolmentCodeExpiresAt: null,
					enrolledAt: now,
				})
				.where(
					and(
						eq(devices.enrolmentCode, input.code),
						gt(devices.enrolmentCodeExpiresAt, now),
						sql`${devices.ownerId} is null or ${devices.ownerId} = ${context.session.user.id}`,
					),
				)
				.returning({
					id: devices.id,
					hostname: devices.hostname,
					connected: devices.connected,
					lastSeenAt: devices.lastSeenAt,
				});
			if (!enrolled[0])
				throw new ORPCError("NOT_FOUND", {
					message: "Enrolment code is invalid or expired",
				});
			return enrolled[0];
		},
	),
	listDevices: protectedProcedure.listDevices.handler(async () => {
		const rows = await db
			.select({
				id: devices.id,
				ownerId: devices.ownerId,
				ownerName: user.name,
				ownerEmail: user.email,
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
			.orderBy(desc(devices.lastSeenAt));
		return Promise.all(
			rows.map(async (device) => ({
				...device,
				lastCommand:
					(
						await db
							.select({
								id: deviceCommands.id,
								tool: deviceCommands.tool,
								status: deviceCommands.status,
								createdAt: deviceCommands.createdAt,
								completedAt: deviceCommands.completedAt,
							})
							.from(deviceCommands)
							.where(eq(deviceCommands.deviceId, device.id))
							.orderBy(desc(deviceCommands.createdAt))
							.limit(1)
					)[0] ?? null,
			})),
		);
	}),
	listDeviceCommands: protectedProcedure.listDeviceCommands.handler(
		({ input }) =>
			db
				.select()
				.from(deviceCommands)
				.where(eq(deviceCommands.deviceId, input.deviceId))
				.orderBy(desc(deviceCommands.sequence))
				.limit(input.limit),
	),
	ticketStats: protectedProcedure.ticketStats.handler(async ({ input }) => {
		const since = new Date(Date.now() - (input.days - 1) * 86_400_000);
		since.setUTCHours(0, 0, 0, 0);
		const escalatedSince = new Date(Date.now() - 86_400_000);
		const [
			statuses,
			priorities,
			openPriorities,
			recordTypes,
			intakeDaily,
			outcomeDaily,
			resolutionRows,
			escalatedRows,
			closedRows,
			humanTransitionRows,
		] = await Promise.all([
			db
				.select({ value: tickets.status, count: count() })
				.from(tickets)
				.groupBy(tickets.status),
			db
				.select({ value: tickets.priority, count: count() })
				.from(tickets)
				.groupBy(tickets.priority),
			db
				.select({ value: tickets.priority, count: count() })
				.from(tickets)
				.where(
					inArray(tickets.status, [
						"open",
						"routing",
						"resolving",
						"escalated",
					]),
				)
				.groupBy(tickets.priority),
			db
				.select({ value: tickets.recordType, count: count() })
				.from(tickets)
				.groupBy(tickets.recordType),
			db
				.select({
					date: sql<string>`to_char(date_trunc('day', ${tickets.createdAt}), 'YYYY-MM-DD')`,
					recordType: tickets.recordType,
					count: count(),
				})
				.from(tickets)
				.where(gte(tickets.createdAt, since))
				.groupBy(
					sql`date_trunc('day', ${tickets.createdAt})`,
					tickets.recordType,
				),
			db
				.select({
					date: sql<string>`to_char(date_trunc('day', ${ticketTransitions.createdAt}), 'YYYY-MM-DD')`,
					status: ticketTransitions.toStatus,
					count: count(),
				})
				.from(ticketTransitions)
				.where(
					and(
						inArray(ticketTransitions.toStatus, ["resolved", "escalated"]),
						gte(ticketTransitions.createdAt, since),
					),
				)
				.groupBy(
					sql`date_trunc('day', ${ticketTransitions.createdAt})`,
					ticketTransitions.toStatus,
				),
			db
				.select({
					duration: sql<number>`extract(epoch from (${tickets.resolvedAt} - ${tickets.createdAt})) * 1000`,
				})
				.from(tickets)
				.where(sql`${tickets.resolvedAt} is not null`)
				.orderBy(sql`${tickets.resolvedAt} - ${tickets.createdAt}`),
			db
				.select({ count: countDistinct(ticketTransitions.ticketId) })
				.from(ticketTransitions)
				.where(
					and(
						eq(ticketTransitions.toStatus, "escalated"),
						gte(ticketTransitions.createdAt, escalatedSince),
					),
				),
			db
				.select({ count: count() })
				.from(tickets)
				.where(eq(tickets.status, "closed")),
			db
				.select({ count: countDistinct(ticketTransitions.ticketId) })
				.from(ticketTransitions)
				.innerJoin(tickets, eq(ticketTransitions.ticketId, tickets.id))
				.where(
					and(
						eq(tickets.status, "closed"),
						eq(ticketTransitions.actorType, "human"),
					),
				),
		]);
		const dates = Array.from({ length: input.days }, (_, index) =>
			new Date(since.getTime() + index * 86_400_000).toISOString().slice(0, 10),
		);
		const middle = Math.floor(resolutionRows.length / 2);
		const median = !resolutionRows.length
			? null
			: resolutionRows.length % 2
				? (resolutionRows[middle]?.duration ?? 0)
				: ((resolutionRows[middle - 1]?.duration ?? 0) +
						(resolutionRows[middle]?.duration ?? 0)) /
					2;
		const closedTotal = closedRows[0]?.count ?? 0;
		const autonomousClosed = Math.max(
			0,
			closedTotal - (humanTransitionRows[0]?.count ?? 0),
		);
		return {
			byStatus: Object.fromEntries(
				TICKET_STATUSES.map((value) => [
					value,
					statuses.find((row) => row.value === value)?.count ?? 0,
				]),
			) as Record<(typeof TICKET_STATUSES)[number], number>,
			byPriority: Object.fromEntries(
				PRIORITIES.map((value) => [
					value,
					priorities.find((row) => row.value === value)?.count ?? 0,
				]),
			) as Record<(typeof PRIORITIES)[number], number>,
			byRecordType: Object.fromEntries(
				RECORD_TYPES.map((value) => [
					value,
					recordTypes.find((row) => row.value === value)?.count ?? 0,
				]),
			) as Record<(typeof RECORD_TYPES)[number], number>,
			openByPriority: Object.fromEntries(
				PRIORITIES.map((value) => [
					value,
					openPriorities.find((row) => row.value === value)?.count ?? 0,
				]),
			) as Record<(typeof PRIORITIES)[number], number>,
			awaitingConfirmation:
				statuses.find((row) => row.value === "resolved")?.count ?? 0,
			escalatedLast24h: escalatedRows[0]?.count ?? 0,
			escalatedSince,
			closedTotal,
			autonomousClosed,
			autonomousResolutionNumerator: autonomousClosed,
			autonomousResolutionDenominator: closedTotal,
			autonomousResolutionRate: closedTotal
				? autonomousClosed / closedTotal
				: null,
			daily: dates.map((date) => ({
				date,
				incidents: intakeDaily
					.filter((row) => row.date === date && row.recordType === "incident")
					.reduce((sum, row) => sum + row.count, 0),
				serviceRequests: intakeDaily
					.filter(
						(row) => row.date === date && row.recordType === "service_request",
					)
					.reduce((sum, row) => sum + row.count, 0),
				resolved: outcomeDaily
					.filter((row) => row.date === date && row.status === "resolved")
					.reduce((sum, row) => sum + row.count, 0),
				escalated: outcomeDaily
					.filter((row) => row.date === date && row.status === "escalated")
					.reduce((sum, row) => sum + row.count, 0),
			})),
			medianTimeToResolutionMs: median,
		};
	}),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
