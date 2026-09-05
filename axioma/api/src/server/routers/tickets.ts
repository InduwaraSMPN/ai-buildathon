import { ORPCError } from "@orpc/server";
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
	approvals,
	changes,
	changeTicketLinks,
	devices,
	itsmConnectors,
	itsmTicketOrigins,
	pendingReasons,
	serviceSubcategories,
	services,
	ticketAudit,
	ticketCsatResponses,
	ticketLinks,
	ticketMerges,
	ticketMessages,
	ticketNumberHistory,
	ticketPresence,
	ticketRuleFirings,
	ticketScheduling,
	ticketStatuses,
	tickets,
	ticketTimeEntries,
	ticketTransitions,
	user,
} from "@/db/schema";
import { teamMembers, teams } from "@/db/schema/org";
import { env } from "@/env";
import {
	derivePriority,
	PRIORITIES,
	RECORD_TYPES,
	RESOLUTION_CODES,
	type StateType,
	TICKET_ROUTES,
} from "@/shared";
import {
	readDynamicFieldValues,
	writeDynamicFieldValues,
} from "../dynamic-fields";
import { grpcGateway } from "../grpc";
import { toPortalMessages } from "../messages";
import {
	anyCapabilityProcedure,
	assertCapabilities,
	capabilityProcedure,
} from "../orpc";
import { nextPendingFollowupAt } from "../pending";
import { listLinkedPublishedWorkarounds } from "../problems";
import { indexTicket } from "../search/projections";
import { listTicketSla, slaAttainment } from "../sla/read";
import { transitionTicketStopwatches } from "../sla/runtime";
import { auditChanges } from "../ticket-records";
import { preserveUndefined, resolveTicketStatus } from "../tickets";
import { createTicket } from "../tickets/create";
import { fireEvent } from "../workflows/runtime";
import { startTicketRun } from "./shared";

export async function findTicketMessages(ticketId: string) {
	return db
		.select()
		.from(ticketMessages)
		.where(eq(ticketMessages.ticketId, ticketId))
		.orderBy(asc(ticketMessages.createdAt), asc(ticketMessages.id));
}

const encodeCursor = (value: string | Date, updatedAt: Date, id: string) =>
	Buffer.from(
		JSON.stringify([
			value instanceof Date ? value.toISOString() : value,
			updatedAt.toISOString(),
			id,
		]),
	).toString("base64url");

const ticketSelection = {
	id: tickets.id,
	number: tickets.number,
	mergedIntoId: tickets.mergedIntoId,
	reporterId: tickets.reporterId,
	reporterName: user.name,
	assigneeId: tickets.assigneeId,
	assigneeName: sql<
		string | null
	>`(select name from "user" where id = ${tickets.assigneeId})`,
	ownerId: tickets.ownerId,
	ownerName: sql<
		string | null
	>`(select name from "user" where id = ${tickets.ownerId})`,
	teamId: tickets.teamId,
	teamName: sql<
		string | null
	>`(select name from ${teams} where id = ${tickets.teamId})`,
	deviceId: tickets.deviceId,
	// Correlated subqueries rather than a join, matching the columns around
	// them, so a ticket with no connector origin stays a single row.
	connectorLabel: sql<string | null>`(select c.label from ${itsmTicketOrigins} o
		join ${itsmConnectors} c on c.id = o.connector_id
		where o.ticket_id = ${tickets.id})`,
	externalKey: sql<
		string | null
	>`(select o.external_key from ${itsmTicketOrigins} o
		where o.ticket_id = ${tickets.id})`,
	title: tickets.title,
	body: tickets.body,
	recordType: tickets.recordType,
	impact: tickets.impact,
	urgency: tickets.urgency,
	priority: tickets.priority,
	serviceId: tickets.serviceId,
	serviceName: sql<string>`(select name from ${services} where id = ${tickets.serviceId})`,
	serviceSubcategoryId: tickets.serviceSubcategoryId,
	serviceSubcategoryName: sql<string>`(select name from ${serviceSubcategories} where id = ${tickets.serviceSubcategoryId})`,
	status: tickets.status,
	statusLabel: sql<string>`(select label from ${ticketStatuses} where key = ${tickets.status})`,
	statusStateType: sql<StateType>`(select state_type from ${ticketStatuses} where key = ${tickets.status})`,
	route: tickets.route,
	resolution: tickets.resolution,
	resolutionCode: tickets.resolutionCode,
	escalationNote: tickets.escalationNote,
	escalationFlag: tickets.escalationFlag,
	escalationReason: tickets.escalationReason,
	progressMarker: tickets.progressMarker,
	pendingReasonId: tickets.pendingReasonId,
	pendingUntil: tickets.pendingUntil,
	lastPendingAt: tickets.lastPendingAt,
	pendingFollowups: tickets.pendingFollowups,
	createdAt: tickets.createdAt,
	updatedAt: tickets.updatedAt,
	resolvedAt: tickets.resolvedAt,
	closedAt: tickets.closedAt,
	reopenedAt: tickets.reopenedAt,
};

export function decodeCursor(cursor: string): [string, string, string] {
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

const withCustomFields = async <T extends { id: string }>(ticket: T) => ({
	...ticket,
	customFields: await readDynamicFieldValues(db, "ticket", ticket.id),
});

export async function findTicket(id: string, reporterId?: string) {
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

/**
 * Excludes tickets whose record lives in a customer's own service desk.
 *
 * Applied to the reporter-scoped paths only. An employee whose ticket was
 * filed in the foreign system has their front door there; showing it in our
 * portal as well gives them two places to look and two places to reply.
 *
 * In SQL rather than in the component, because the portal's boundary is
 * enforced by data shape — a page that renders nothing while fetching it is
 * still a leak, and this follows `getMyTicket`'s own precedent.
 */
const notForeignOwned = sql`not exists (
	select 1 from ${itsmTicketOrigins}
	where ${itsmTicketOrigins.ticketId} = ${tickets.id}
)`;

export const ticketsRouter = {
	createTicket: capabilityProcedure("ticket.create").createTicket.handler(
		async ({ context, input }) => {
			if (input.recordType === "service_request")
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Service requests must be submitted through the request catalogue",
				});
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
									eq(devices.ownerId, context.userId),
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
						.where(eq(devices.ownerId, context.userId))
						.orderBy(desc(devices.lastSeenAt))
						.limit(1)
				)[0]?.id;
			}
			const createdCore = await createTicket({
				source: "portal",
				reporterId: context.userId,
				idempotencyKey: input.idempotencyKey,
				customFields: input.customFields,
				title: input.title,
				body: input.body,
				serviceId: input.serviceId,
				serviceSubcategoryId: input.serviceSubcategoryId,
				recordType: input.recordType,
				impact: input.impact,
				urgency: input.urgency,
				deviceId,
			});
			let created = await findTicket(createdCore.ticketId);
			if (!created) throw new ORPCError("INTERNAL_SERVER_ERROR");
			if (
				createdCore.created &&
				env.AXIOMA_AUTO_DISPATCH &&
				grpcGateway.hasWorker() &&
				!createdCore.settledActions.includes("route_human")
			) {
				await startTicketRun(created);
				created = await findTicket(createdCore.ticketId);
				if (!created) throw new ORPCError("INTERNAL_SERVER_ERROR");
			}
			return withCustomFields(created);
		},
	),
	listTickets: anyCapabilityProcedure(
		"ticket.read.own",
		"ticket.read.all",
	).listTickets.handler(async ({ context, input }) => {
		assertCapabilities(
			context,
			input.scope === "all" ? "ticket.read.all" : "ticket.read.own",
		);
		if (input.status?.length) {
			const validStatuses = await db
				.select({ key: ticketStatuses.key })
				.from(ticketStatuses)
				.where(inArray(ticketStatuses.key, input.status));
			const validKeys = new Set(validStatuses.map(({ key }) => key));
			const invalid = input.status.filter((status) => !validKeys.has(status));
			if (invalid.length)
				throw new ORPCError("BAD_REQUEST", {
					message: `Unknown ticket status: ${invalid.join(", ")}`,
				});
		}
		const filters = [
			sql`not exists (
				select 1 from ${ticketScheduling}
				where ${ticketScheduling.ticketId} = ${tickets.id}
					and ${ticketScheduling.snoozedUntil} > now()
			)`,
			input.scope === "mine"
				? and(eq(tickets.reporterId, context.userId), notForeignOwned)
				: undefined,
			input.myQueue
				? or(
						eq(tickets.assigneeId, context.userId),
						sql`${tickets.teamId} in (select ${teamMembers.teamId} from ${teamMembers} where ${teamMembers.userId} = ${context.userId})`,
					)
				: undefined,
			input.assigneeId ? eq(tickets.assigneeId, input.assigneeId) : undefined,
			input.teamId ? eq(tickets.teamId, input.teamId) : undefined,
			input.connectorId
				? sql`exists (
					select 1 from ${itsmTicketOrigins}
					where ${itsmTicketOrigins.ticketId} = ${tickets.id}
						and ${itsmTicketOrigins.connectorId} = ${input.connectorId}
				)`
				: undefined,
			input.status?.length ? inArray(tickets.status, input.status) : undefined,
			input.priority?.length
				? inArray(tickets.priority, input.priority)
				: undefined,
			input.recordType?.length
				? inArray(tickets.recordType, input.recordType)
				: undefined,
			input.serviceId?.length
				? inArray(tickets.serviceId, input.serviceId)
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
			// Parenthesised: `and()` concatenates its operands verbatim, so a bare
			// top-level `or` here would bind looser than the surrounding `and`s and
			// silently drop every other filter from one half of the predicate —
			// including the reporter scope.
			input.unassigned
				? or(sql`${tickets.route} is null`, eq(tickets.route, "unassigned"))
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
						ilike(tickets.number, `%${input.search}%`),
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
		const items = await Promise.all(
			rows.slice(0, input.limit).map(withCustomFields),
		);
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
				? and(eq(tickets.reporterId, context.userId), notForeignOwned)
				: undefined;
		const [
			statusDefinitions,
			statuses,
			priorities,
			recordTypes,
			serviceFacets,
			connectorFacets,
			routes,
			assignees,
			ticketTeams,
		] = await Promise.all([
			db
				.select({ key: ticketStatuses.key, label: ticketStatuses.label })
				.from(ticketStatuses)
				.where(eq(ticketStatuses.isActive, true))
				.orderBy(asc(ticketStatuses.displayOrder)),
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
				.select({
					id: services.id,
					name: services.name,
					count: count(tickets.id),
				})
				.from(services)
				.innerJoin(tickets, eq(tickets.serviceId, services.id))
				.where(scope)
				.groupBy(services.id, services.name)
				.orderBy(asc(services.name)),
			// Which service desk a ticket came from. Only connectors that own at
			// least one ticket appear, so the facet is empty in a deployment with
			// no connector rather than showing an always-zero row.
			db
				.select({
					id: itsmConnectors.id,
					name: itsmConnectors.label,
					count: count(tickets.id),
				})
				.from(itsmConnectors)
				.innerJoin(
					itsmTicketOrigins,
					eq(itsmTicketOrigins.connectorId, itsmConnectors.id),
				)
				.innerJoin(tickets, eq(tickets.id, itsmTicketOrigins.ticketId))
				.where(scope)
				.groupBy(itsmConnectors.id, itsmConnectors.label)
				.orderBy(asc(itsmConnectors.label)),
			db
				.select({ value: tickets.route, count: count() })
				.from(tickets)
				.where(scope)
				.groupBy(tickets.route),
			db
				.select({ id: user.id, name: user.name, count: count(tickets.id) })
				.from(user)
				.innerJoin(tickets, eq(tickets.assigneeId, user.id))
				.where(scope)
				.groupBy(user.id, user.name)
				.orderBy(asc(user.name)),
			db
				.select({ id: teams.id, name: teams.name, count: count(tickets.id) })
				.from(teams)
				.innerJoin(tickets, eq(tickets.teamId, teams.id))
				.where(scope)
				.groupBy(teams.id, teams.name)
				.orderBy(asc(teams.name)),
		]);
		return {
			items,
			nextCursor,
			facets: {
				connector: connectorFacets,
				status: statusDefinitions.map(({ key: value, label }) => ({
					value,
					label,
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
				service: serviceFacets,
				route: [...TICKET_ROUTES, null].map((value) => ({
					value,
					count: routes.find((row) => row.value === value)?.count ?? 0,
				})),
				assignee: [...assignees],
				team: ticketTeams,
			},
		};
	}),
	getTicket: capabilityProcedure("ticket.read.all").getTicket.handler(
		async ({ input }) => {
			const ticket = await findTicket(input.id);
			if (!ticket) return null;
			const messages = await findTicketMessages(input.id);
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
				messages,
			};
		},
	),
	getMyTicket: capabilityProcedure("ticket.read.own").getMyTicket.handler(
		async ({ context, input }) => {
			const ticket = await findTicket(input.id, context.userId);
			if (!ticket) return null;
			const [messages, csat] = await Promise.all([
				db
					.select()
					.from(ticketMessages)
					.where(
						and(
							eq(ticketMessages.ticketId, input.id),
							eq(ticketMessages.visibility, "public"),
						),
					)
					.orderBy(asc(ticketMessages.createdAt)),
				db
					.select({
						token: ticketCsatResponses.token,
						rating: ticketCsatResponses.rating,
						comment: ticketCsatResponses.comment,
						respondedAt: ticketCsatResponses.respondedAt,
					})
					.from(ticketCsatResponses)
					.where(eq(ticketCsatResponses.ticketId, input.id))
					.limit(1),
			]);
			return {
				...(await withCustomFields(ticket)),
				messages: toPortalMessages(messages),
				csat: csat[0] ?? null,
			};
		},
	),
	heartbeatTicketPresence: capabilityProcedure(
		"ticket.read.all",
	).heartbeatTicketPresence.handler(async ({ context, input }) => {
		if (!(await findTicket(input.ticketId))) throw new ORPCError("NOT_FOUND");
		const lastSeenAt = new Date();
		const expiresAt = new Date(lastSeenAt.getTime() + 45_000);
		await db
			.insert(ticketPresence)
			.values({
				ticketId: input.ticketId,
				userId: context.userId,
				lastSeenAt,
				expiresAt,
			})
			.onConflictDoUpdate({
				target: [ticketPresence.ticketId, ticketPresence.userId],
				set: { lastSeenAt, expiresAt },
			});
		return { lastSeenAt };
	}),
	listTicketPresence: capabilityProcedure(
		"ticket.read.all",
	).listTicketPresence.handler(async ({ context, input }) => {
		if (!(await findTicket(input.ticketId))) throw new ORPCError("NOT_FOUND");
		const now = new Date();
		await db.delete(ticketPresence).where(lt(ticketPresence.expiresAt, now));
		return db
			.select({
				userId: ticketPresence.userId,
				userName: user.name,
				lastSeenAt: ticketPresence.lastSeenAt,
			})
			.from(ticketPresence)
			.innerJoin(user, eq(ticketPresence.userId, user.id))
			.where(
				and(
					eq(ticketPresence.ticketId, input.ticketId),
					gt(ticketPresence.expiresAt, now),
					sql`${ticketPresence.userId} <> ${context.userId}`,
				),
			)
			.orderBy(desc(ticketPresence.lastSeenAt));
	}),
	listTicketSla: capabilityProcedure("ticket.read.all").listTicketSla.handler(
		async ({ input }) => {
			if (!(await findTicket(input.ticketId))) throw new ORPCError("NOT_FOUND");
			return listTicketSla(input.ticketId);
		},
	),
	submitTicketCsat: capabilityProcedure(
		"ticket.read.own",
	).submitTicketCsat.handler(async ({ input }) => {
		const updated = await db
			.update(ticketCsatResponses)
			.set({
				rating: input.rating,
				comment: input.comment?.trim() || null,
				respondedAt: new Date(),
			})
			.where(
				and(
					eq(ticketCsatResponses.token, input.token),
					sql`${ticketCsatResponses.respondedAt} is null`,
				),
			)
			.returning({ id: ticketCsatResponses.id });
		if (!updated[0])
			throw new ORPCError("CONFLICT", {
				message: "This satisfaction link is invalid or has already been used",
			});
		return { accepted: true as const };
	}),
	addTicketMessage: capabilityProcedure(
		"ticket.read.all",
	).addTicketMessage.handler(async ({ context, input }) => {
		if (!(await findTicket(input.ticketId))) throw new ORPCError("NOT_FOUND");
		const [message] = await db
			.insert(ticketMessages)
			.values({
				id: crypto.randomUUID(),
				ticketId: input.ticketId,
				authorId: context.userId,
				authorType: "staff",
				body: input.body,
				visibility: input.visibility,
			})
			.returning();
		if (!message) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return message;
	}),
	addMyTicketMessage: capabilityProcedure(
		"ticket.read.own",
	).addMyTicketMessage.handler(async ({ context, input }) => {
		const ticket = await findTicket(input.ticketId, context.userId);
		if (!ticket) throw new ORPCError("NOT_FOUND");
		const unpendStatus =
			ticket.statusStateType === "pending"
				? await resolveTicketStatus(ticket.status, "unpend")
				: null;
		const message = await db.transaction(async (tx) => {
			const [message] = await tx
				.insert(ticketMessages)
				.values({
					id: crypto.randomUUID(),
					ticketId: input.ticketId,
					authorId: context.userId,
					authorType: "reporter",
					body: input.body,
					visibility: "public",
				})
				.returning();
			if (!message) throw new ORPCError("INTERNAL_SERVER_ERROR");
			if (!unpendStatus) return message;
			const now = new Date();
			const changed = await tx
				.update(tickets)
				.set({
					status: unpendStatus,
					pendingReasonId: null,
					pendingUntil: null,
					lastPendingAt: null,
					updatedAt: now,
				})
				.where(
					and(
						eq(tickets.id, input.ticketId),
						eq(tickets.status, ticket.status),
					),
				)
				.returning({ id: tickets.id });
			if (!changed[0]) return message;
			await tx.insert(ticketTransitions).values({
				id: crypto.randomUUID(),
				ticketId: input.ticketId,
				fromStatus: ticket.status,
				toStatus: unpendStatus,
				action: "unpend",
				// The reporter drove this, not a person working the queue: recorded as
				// `agent` so it is not counted as human handling until the column's
				// enum admits `reporter`.
				actorType: "agent",
				actorId: context.userId,
			});
			await transitionTicketStopwatches(input.ticketId, unpendStatus, now, tx);
			return message;
		});
		const [portalMessage] = toPortalMessages([message]);
		if (!portalMessage) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return portalMessage;
	}),
	listTicketLinks: capabilityProcedure(
		"ticket.read.all",
	).listTicketLinks.handler(async ({ input }) => {
		if (!(await findTicket(input.ticketId))) throw new ORPCError("NOT_FOUND");
		return db
			.select()
			.from(ticketLinks)
			.where(
				or(
					eq(ticketLinks.ticketId, input.ticketId),
					eq(ticketLinks.targetTicketId, input.ticketId),
				),
			)
			.orderBy(desc(ticketLinks.createdAt));
	}),
	linkTickets: capabilityProcedure("ticket.reclassify").linkTickets.handler(
		async ({ context, input }) => {
			if (input.ticketId === input.targetTicketId)
				throw new ORPCError("BAD_REQUEST", {
					message: "A ticket cannot link to itself",
				});
			const found = await db
				.select({ id: tickets.id })
				.from(tickets)
				.where(inArray(tickets.id, [input.ticketId, input.targetTicketId]));
			if (found.length !== 2) throw new ORPCError("NOT_FOUND");
			try {
				const [row] = await db
					.insert(ticketLinks)
					.values({
						id: crypto.randomUUID(),
						...input,
						createdBy: context.userId,
					})
					.returning();
				if (!row) throw new Error("Ticket link insert failed");
				return row;
			} catch (error) {
				if ((error as { code?: string }).code === "23505")
					throw new ORPCError("CONFLICT", {
						message: "Ticket link already exists",
					});
				throw error;
			}
		},
	),
	unlinkTickets: capabilityProcedure("ticket.reclassify").unlinkTickets.handler(
		async ({ input }) => ({
			deleted: Boolean(
				(
					await db
						.delete(ticketLinks)
						.where(eq(ticketLinks.id, input.id))
						.returning({ id: ticketLinks.id })
				)[0],
			),
		}),
	),
	mergeTickets: capabilityProcedure("ticket.reclassify").mergeTickets.handler(
		async ({ context, input }) => {
			if (input.sourceTicketId === input.targetTicketId)
				throw new ORPCError("BAD_REQUEST", {
					message: "A ticket cannot merge into itself",
				});
			await db.transaction(async (tx) => {
				const source = (
					await tx
						.select({ status: tickets.status })
						.from(tickets)
						.where(
							and(
								eq(tickets.id, input.sourceTicketId),
								sql`${tickets.mergedIntoId} is null`,
							),
						)
						.limit(1)
				)[0];
				if (
					!source ||
					!(
						await tx
							.select({ id: tickets.id })
							.from(tickets)
							.where(eq(tickets.id, input.targetTicketId))
							.limit(1)
					)[0]
				)
					throw new ORPCError("CONFLICT", {
						message: "Ticket is missing or already merged",
					});
				await tx
					.update(tickets)
					.set({ mergedIntoId: input.targetTicketId, updatedAt: new Date() })
					.where(
						and(
							eq(tickets.id, input.sourceTicketId),
							sql`${tickets.mergedIntoId} is null`,
						),
					);
				await tx.insert(ticketMerges).values({
					id: crypto.randomUUID(),
					sourceTicketId: input.sourceTicketId,
					targetTicketId: input.targetTicketId,
					sourcePreviousStatus: source.status,
					mergedBy: context.userId,
				});
			});
			const ticket = await findTicket(input.sourceTicketId);
			if (!ticket) throw new Error("Merged ticket not found");
			return ticket;
		},
	),
	unmergeTicket: capabilityProcedure("ticket.reclassify").unmergeTicket.handler(
		async ({ context, input }) => {
			await db.transaction(async (tx) => {
				const merge = (
					await tx
						.select()
						.from(ticketMerges)
						.where(
							and(
								eq(ticketMerges.sourceTicketId, input.sourceTicketId),
								sql`${ticketMerges.undoneAt} is null`,
							),
						)
						.orderBy(desc(ticketMerges.mergedAt))
						.limit(1)
				)[0];
				if (!merge)
					throw new ORPCError("CONFLICT", { message: "Ticket is not merged" });
				const changed = await tx
					.update(tickets)
					.set({ mergedIntoId: null, updatedAt: new Date() })
					.where(
						and(
							eq(tickets.id, input.sourceTicketId),
							eq(tickets.mergedIntoId, merge.targetTicketId),
						),
					)
					.returning({ id: tickets.id });
				if (!changed[0])
					throw new ORPCError("CONFLICT", {
						message: "Merge changed concurrently",
					});
				await tx
					.update(ticketMerges)
					.set({ undoneAt: new Date(), undoneBy: context.userId })
					.where(eq(ticketMerges.id, merge.id));
			});
			const ticket = await findTicket(input.sourceTicketId);
			if (!ticket) throw new Error("Unmerged ticket not found");
			return ticket;
		},
	),
	listTicketAudit: capabilityProcedure(
		"ticket.read.all",
	).listTicketAudit.handler(({ input }) =>
		db
			.select()
			.from(ticketAudit)
			.where(eq(ticketAudit.ticketId, input.ticketId))
			.orderBy(desc(ticketAudit.createdAt)),
	),
	listTicketRuleFirings: capabilityProcedure(
		"ticket.read.all",
	).listTicketRuleFirings.handler(({ input }) =>
		db
			.select()
			.from(ticketRuleFirings)
			.where(eq(ticketRuleFirings.ticketId, input.ticketId))
			.orderBy(desc(ticketRuleFirings.createdAt)),
	),
	listTicketTimeEntries: capabilityProcedure(
		"ticket.read.all",
	).listTicketTimeEntries.handler(async ({ input }) => {
		const entries = await db
			.select()
			.from(ticketTimeEntries)
			.where(eq(ticketTimeEntries.ticketId, input.ticketId))
			.orderBy(desc(ticketTimeEntries.createdAt));
		return {
			entries,
			totalMinutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
		};
	}),
	addTicketTimeEntry: capabilityProcedure(
		"ticket.reclassify",
	).addTicketTimeEntry.handler(async ({ context, input }) => {
		if (!(await findTicket(input.ticketId))) throw new ORPCError("NOT_FOUND");
		const [row] = await db
			.insert(ticketTimeEntries)
			.values({
				id: crypto.randomUUID(),
				ticketId: input.ticketId,
				userId: context.userId,
				minutes: input.minutes,
				note: input.note,
			})
			.returning();
		if (!row) throw new Error("Ticket time entry insert failed");
		return row;
	}),
	lookupTicket: capabilityProcedure("ticket.read.all").lookupTicket.handler(
		async ({ input }) => {
			const history = (
				await db
					.select({ ticketId: ticketNumberHistory.ticketId })
					.from(ticketNumberHistory)
					.where(eq(ticketNumberHistory.number, input.reference))
					.limit(1)
			)[0];
			const current =
				history ??
				(
					await db
						.select({ ticketId: tickets.id })
						.from(tickets)
						.where(eq(tickets.number, input.reference))
						.limit(1)
				)[0];
			return (await findTicket(current?.ticketId ?? input.reference)) ?? null;
		},
	),
	listTicketAssignmentOptions: capabilityProcedure(
		"ticket.assign",
	).listTicketAssignmentOptions.handler(async () => ({
		users: await db
			.select({ id: user.id, name: user.name })
			.from(user)
			.where(eq(user.kind, "staff"))
			.orderBy(asc(user.name)),
		teams: await db
			.select({ id: teams.id, name: teams.name })
			.from(teams)
			.orderBy(asc(teams.name)),
	})),
	listPendingReasons: capabilityProcedure(
		"ticket.update",
	).listPendingReasons.handler(async () =>
		db.select().from(pendingReasons).orderBy(asc(pendingReasons.name)),
	),
	setTicketDynamicFields: capabilityProcedure(
		"ticket.update",
	).setTicketDynamicFields.handler(async ({ input }) => {
		if (!(await findTicket(input.ticketId))) throw new ORPCError("NOT_FOUND");
		const values = await writeDynamicFieldValues(
			db,
			"ticket",
			input.ticketId,
			input.values,
		);
		await indexTicket(db, input.ticketId);
		return values;
	}),
	updateTicket: anyCapabilityProcedure(
		"ticket.create",
		"ticket.resolve",
		"ticket.close",
		"ticket.escalate",
		"ticket.reclassify",
		"ticket.assign",
		"ticket.reopen",
	).updateTicket.handler(async ({ context, input }) => {
		const required = {
			close: "ticket.close",
			escalate: "ticket.escalate",
			add_detail: "ticket.create",
			resolve: "ticket.resolve",
			reopen: "ticket.reopen",
			pend: "ticket.reclassify",
			unpend: "ticket.reclassify",
			reclassify: "ticket.reclassify",
			assign: "ticket.assign",
		} as const;
		const current = await findTicket(input.id);
		if (!current) throw new ORPCError("NOT_FOUND");
		const reporterVerdict =
			current.reporterId === context.userId &&
			current.statusStateType === "resolved" &&
			(input.action === "close" || input.action === "escalate");
		if (!reporterVerdict) assertCapabilities(context, required[input.action]);
		if (input.action === "add_detail" && current.reporterId !== context.userId)
			throw new ORPCError("FORBIDDEN");
		if (["resolve", "close", "assign"].includes(input.action)) {
			const approval = (
				await db
					.select({ status: approvals.status })
					.from(approvals)
					.where(eq(approvals.ticketId, input.id))
					.orderBy(desc(approvals.requestedAt))
					.limit(1)
			)[0];
			if (approval?.status && approval.status !== "approved")
				throw new ORPCError("CONFLICT", {
					message: "This request cannot proceed without approval",
				});
		}
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
		if (input.action === "assign") {
			const userIds = [input.assigneeId, input.ownerId].filter(
				(id): id is string => typeof id === "string",
			);
			if (
				userIds.length &&
				(
					await db
						.select({ id: user.id })
						.from(user)
						.where(and(inArray(user.id, userIds), eq(user.kind, "staff")))
				).length !== new Set(userIds).size
			)
				throw new ORPCError("BAD_REQUEST", {
					message: "Assignee and owner must be staff users",
				});
			if (
				input.teamId &&
				!(
					await db
						.select({ id: teams.id })
						.from(teams)
						.where(eq(teams.id, input.teamId))
						.limit(1)
				)[0]
			)
				throw new ORPCError("BAD_REQUEST", { message: "Unknown team" });
		}
		const pendingReason =
			input.action === "pend"
				? (
						await db
							.select()
							.from(pendingReasons)
							.where(eq(pendingReasons.id, input.reasonId))
							.limit(1)
					)[0]
				: undefined;
		let pendingFollowupFrequencyMinutes: number | undefined;
		let requestedPendingUntil: Date | undefined;
		if (input.action === "pend") {
			if (!pendingReason)
				throw new ORPCError("BAD_REQUEST", {
					message: "Unknown pending reason",
				});
			pendingFollowupFrequencyMinutes = pendingReason.followupFrequencyMinutes;
			requestedPendingUntil = input.until;
		}
		const nextStatus = await resolveTicketStatus(current.status, input.action);
		const impact =
			input.action === "reclassify"
				? (input.impact ?? current.impact)
				: current.impact;
		const urgency =
			input.action === "reclassify"
				? (input.urgency ?? current.urgency)
				: current.urgency;
		const serviceId =
			input.action === "reclassify"
				? (input.serviceId ?? current.serviceId)
				: current.serviceId;
		const serviceSubcategoryId =
			input.action === "reclassify"
				? (input.serviceSubcategoryId ?? current.serviceSubcategoryId)
				: current.serviceSubcategoryId;
		if (input.action === "reclassify") {
			const [validClassification] = await db
				.select({ id: serviceSubcategories.id })
				.from(serviceSubcategories)
				.where(
					and(
						eq(serviceSubcategories.id, serviceSubcategoryId),
						eq(serviceSubcategories.serviceId, serviceId),
					),
				)
				.limit(1);
			if (!validClassification)
				throw new ORPCError("BAD_REQUEST", {
					message: "Ticket service and subcategory do not match",
				});
		}
		const now = new Date();
		let pendingUntil = current.pendingUntil;
		if (pendingFollowupFrequencyMinutes !== undefined) {
			pendingUntil =
				requestedPendingUntil ??
				nextPendingFollowupAt(now, pendingFollowupFrequencyMinutes);
		} else if (input.action === "unpend") {
			pendingUntil = null;
		}
		await db.transaction(async (tx) => {
			const changed = await tx
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
					serviceId,
					serviceSubcategoryId,
					route:
						input.action === "assign"
							? preserveUndefined(input.route, current.route)
							: input.action === "escalate"
								? input.route
								: current.route,
					assigneeId:
						input.action === "assign"
							? preserveUndefined(input.assigneeId, current.assigneeId)
							: current.assigneeId,
					ownerId:
						input.action === "assign"
							? preserveUndefined(input.ownerId, current.ownerId)
							: current.ownerId,
					teamId:
						input.action === "assign"
							? preserveUndefined(input.teamId, current.teamId)
							: current.teamId,
					resolution:
						input.action === "resolve" ? input.resolution : current.resolution,
					resolutionCode:
						input.action === "resolve"
							? input.resolutionCode
							: input.action === "reopen"
								? null
								: current.resolutionCode,
					escalationNote:
						input.action === "escalate" ? input.note : current.escalationNote,
					escalationFlag:
						input.action === "escalate"
							? "warning"
							: ["reopen", "pend", "unpend"].includes(input.action)
								? "none"
								: current.escalationFlag,
					escalationReason: ["reopen", "pend", "unpend"].includes(input.action)
						? null
						: current.escalationReason,
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
					pendingReasonId:
						input.action === "pend"
							? input.reasonId
							: input.action === "unpend"
								? null
								: current.pendingReasonId,
					pendingUntil,
					lastPendingAt: input.action === "pend" ? now : current.lastPendingAt,
					pendingFollowups:
						input.action === "pend" ? 0 : current.pendingFollowups,
					lastHumanTransitionAt: now,
					updatedAt: now,
				})
				.where(
					and(eq(tickets.id, input.id), eq(tickets.status, current.status)),
				)
				.returning({
					recordType: tickets.recordType,
					impact: tickets.impact,
					urgency: tickets.urgency,
					priority: tickets.priority,
					serviceId: tickets.serviceId,
					serviceSubcategoryId: tickets.serviceSubcategoryId,
					route: tickets.route,
					assigneeId: tickets.assigneeId,
					ownerId: tickets.ownerId,
					teamId: tickets.teamId,
				});
			if (!changed[0])
				throw new ORPCError("CONFLICT", {
					message: "Ticket changed while it was being updated",
				});
			if (nextStatus !== current.status)
				await transitionTicketStopwatches(input.id, nextStatus, now, tx);
			if (input.action === "add_detail")
				await tx.insert(ticketMessages).values({
					id: crypto.randomUUID(),
					ticketId: input.id,
					authorId: context.userId,
					authorType: "reporter",
					body: input.note,
					visibility: "public",
				});
			if (input.action === "close")
				await tx
					.insert(ticketCsatResponses)
					.values({
						id: crypto.randomUUID(),
						ticketId: input.id,
						token: `${crypto.randomUUID()}${crypto.randomUUID()}`,
					})
					.onConflictDoNothing({ target: ticketCsatResponses.ticketId });
			if (nextStatus !== current.status)
				await tx.insert(ticketTransitions).values({
					id: crypto.randomUUID(),
					ticketId: input.id,
					fromStatus: current.status,
					toStatus: nextStatus,
					action: input.action,
					actorType: "human",
					actorId: context.userId,
				});
			// Audited from the returned row inside the same transaction: written on
			// the pool afterwards, the trail could be lost while the change stood.
			const auditRows = auditChanges(
				{
					recordType: current.recordType,
					impact: current.impact,
					urgency: current.urgency,
					priority: current.priority,
					serviceId: current.serviceId,
					serviceSubcategoryId: current.serviceSubcategoryId,
					route: current.route,
					assigneeId: current.assigneeId,
					ownerId: current.ownerId,
					teamId: current.teamId,
				},
				changed[0],
			);
			if (auditRows.length)
				await tx.insert(ticketAudit).values(
					auditRows.map((change) => ({
						id: crypto.randomUUID(),
						ticketId: input.id,
						actorId: context.userId,
						...change,
					})),
				);
		});
		const updated = await findTicket(input.id);
		if (!updated) throw new ORPCError("NOT_FOUND");
		try {
			await indexTicket(db, input.id);
		} catch (error) {
			console.error("[tickets] search indexing failed", error);
		}
		void fireEvent({
			type: "ticket.updated",
			source: "ticket",
			recordType: "ticket",
			recordId: input.id,
			actorId: context.userId,
			payload: {
				action: input.action,
				fromStatus: current.status,
				toStatus: nextStatus,
			},
		}).catch((error) =>
			console.error("[tickets] workflow dispatch failed", error),
		);
		return updated;
	}),
	ticketStats: capabilityProcedure("stats.read").ticketStats.handler(
		async ({ input }) => {
			const since = new Date(Date.now() - (input.days - 1) * 86_400_000);
			since.setUTCHours(0, 0, 0, 0);
			const escalatedSince = new Date(Date.now() - 86_400_000);
			const modelSettled = sql`exists (select 1 from ${agentRuns} where ${agentRuns.ticketId} = ${tickets.id})`;
			const ruleSettled = sql`exists (select 1 from ${ticketRuleFirings} where ${ticketRuleFirings.ticketId} = ${tickets.id})`;
			const [
				statusDefinitions,
				statuses,
				priorities,
				openPriorities,
				recordTypes,
				resolutionCodes,
				intakeDaily,
				outcomeDaily,
				resolutionRows,
				escalatedRows,
				settledRows,
				tokenRows,
				csatRows,
				attainment,
			] = await Promise.all([
				db
					.select({
						key: ticketStatuses.key,
						stateType: ticketStatuses.stateType,
					})
					.from(ticketStatuses)
					.where(eq(ticketStatuses.isActive, true))
					.orderBy(asc(ticketStatuses.displayOrder)),
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
						inArray(
							tickets.status,
							db
								.select({ key: ticketStatuses.key })
								.from(ticketStatuses)
								.where(inArray(ticketStatuses.stateType, ["new", "open"])),
						),
					)
					.groupBy(tickets.priority),
				db
					.select({ value: tickets.recordType, count: count() })
					.from(tickets)
					.groupBy(tickets.recordType),
				db
					.select({ value: tickets.resolutionCode, count: count() })
					.from(tickets)
					.where(sql`${tickets.resolutionCode} is not null`)
					.groupBy(tickets.resolutionCode),
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
						stateType: ticketStatuses.stateType,
						action: ticketTransitions.action,
						count: count(),
					})
					.from(ticketTransitions)
					.innerJoin(
						ticketStatuses,
						eq(ticketTransitions.toStatus, ticketStatuses.key),
					)
					.where(
						and(
							or(
								eq(ticketStatuses.stateType, "resolved"),
								inArray(ticketTransitions.action, [
									"escalate",
									"fail",
									"exhaust",
								]),
							),
							gte(ticketTransitions.createdAt, since),
						),
					)
					.groupBy(
						sql`date_trunc('day', ${ticketTransitions.createdAt})`,
						ticketStatuses.stateType,
						ticketTransitions.action,
					),
				db
					.select({
						median: sql<
							number | null
						>`percentile_cont(0.5) within group (order by extract(epoch from (${tickets.resolvedAt} - ${tickets.createdAt})) * 1000)`,
					})
					.from(tickets)
					.where(
						and(
							sql`${tickets.resolvedAt} is not null`,
							gte(tickets.resolvedAt, since),
						),
					),
				db
					.select({ count: countDistinct(ticketTransitions.ticketId) })
					.from(ticketTransitions)
					.where(
						and(
							inArray(ticketTransitions.action, [
								"escalate",
								"fail",
								"exhaust",
							]),
							gte(ticketTransitions.createdAt, escalatedSince),
						),
					),
				// The settled cohort is counted in the database: read back as rows it
				// was every closed ticket, every rule firing and every agent run.
				db
					.select({
						closed: count(),
						model: sql<number>`count(*) filter (where ${modelSettled})`.mapWith(
							Number,
						),
						rule: sql<number>`count(*) filter (where not ${modelSettled} and ${ruleSettled})`.mapWith(
							Number,
						),
					})
					.from(tickets)
					.innerJoin(ticketStatuses, eq(tickets.status, ticketStatuses.key))
					.where(
						and(
							eq(ticketStatuses.isClosed, true),
							gte(tickets.closedAt, since),
						),
					),
				db
					.select({
						promptTokens:
							sql<number>`coalesce(sum(${agentRuns.promptTokens}), 0)`.mapWith(
								Number,
							),
						completionTokens:
							sql<number>`coalesce(sum(${agentRuns.completionTokens}), 0)`.mapWith(
								Number,
							),
					})
					.from(agentRuns)
					.innerJoin(tickets, eq(agentRuns.ticketId, tickets.id))
					.innerJoin(ticketStatuses, eq(tickets.status, ticketStatuses.key))
					.where(
						and(
							eq(ticketStatuses.isClosed, true),
							gte(tickets.closedAt, since),
						),
					),
				db
					.select({ rating: ticketCsatResponses.rating, count: count() })
					.from(ticketCsatResponses)
					.where(sql`${ticketCsatResponses.rating} is not null`)
					.groupBy(ticketCsatResponses.rating),
				slaAttainment(since),
			]);
			const dates = Array.from({ length: input.days }, (_, index) =>
				new Date(since.getTime() + index * 86_400_000)
					.toISOString()
					.slice(0, 10),
			);
			const median = resolutionRows[0]?.median ?? null;
			const settled = settledRows[0];
			const modelSettledCount = settled?.model ?? 0;
			const ruleSettledCount = settled?.rule ?? 0;
			const autonomousClosed = ruleSettledCount + modelSettledCount;
			const closedTotal = settled?.closed ?? 0;
			const promptTokens = tokenRows[0]?.promptTokens ?? 0;
			const completionTokens = tokenRows[0]?.completionTokens ?? 0;
			const totalTokens = promptTokens + completionTokens;
			const tokensPerTicket = {
				ticketCount: closedTotal,
				promptTokens,
				completionTokens,
				totalTokens,
				tokensPerTicket: closedTotal ? totalTokens / closedTotal : null,
			};
			const csatResponses = csatRows.reduce((sum, row) => sum + row.count, 0);
			const csatTotal = csatRows.reduce(
				(sum, row) => sum + (row.rating ?? 0) * row.count,
				0,
			);
			return {
				byStatus: Object.fromEntries(
					statusDefinitions.map(({ key }) => [
						key,
						statuses.find((row) => row.value === key)?.count ?? 0,
					]),
				),
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
				byResolutionCode: Object.fromEntries(
					RESOLUTION_CODES.map((value) => [
						value,
						resolutionCodes.find((row) => row.value === value)?.count ?? 0,
					]),
				) as Record<(typeof RESOLUTION_CODES)[number], number>,
				openByPriority: Object.fromEntries(
					PRIORITIES.map((value) => [
						value,
						openPriorities.find((row) => row.value === value)?.count ?? 0,
					]),
				) as Record<(typeof PRIORITIES)[number], number>,
				awaitingConfirmation: statusDefinitions
					.filter(({ stateType }) => stateType === "resolved")
					.reduce(
						(sum, { key }) =>
							sum + (statuses.find((row) => row.value === key)?.count ?? 0),
						0,
					),
				escalatedLast24h: escalatedRows[0]?.count ?? 0,
				escalatedSince,
				closedTotal,
				autonomousClosed,
				autonomousResolutionNumerator: autonomousClosed,
				autonomousResolutionDenominator: closedTotal,
				autonomousResolutionRate: closedTotal
					? autonomousClosed / closedTotal
					: null,
				settledBy: { rule: ruleSettledCount, model: modelSettledCount },
				tokensPerTicket,
				attainment,
				csat: {
					responses: csatResponses,
					average: csatResponses ? csatTotal / csatResponses : null,
					byRating: Object.fromEntries(
						[1, 2, 3, 4, 5].map((rating) => [
							String(rating),
							csatRows.find((row) => row.rating === rating)?.count ?? 0,
						]),
					),
				},
				daily: dates.map((date) => ({
					date,
					incidents: intakeDaily
						.filter((row) => row.date === date && row.recordType === "incident")
						.reduce((sum, row) => sum + row.count, 0),
					serviceRequests: intakeDaily
						.filter(
							(row) =>
								row.date === date && row.recordType === "service_request",
						)
						.reduce((sum, row) => sum + row.count, 0),
					resolved: outcomeDaily
						.filter((row) => row.date === date && row.stateType === "resolved")
						.reduce((sum, row) => sum + row.count, 0),
					escalated: outcomeDaily
						.filter(
							(row) =>
								row.date === date &&
								["escalate", "fail", "exhaust"].includes(row.action),
						)
						.reduce((sum, row) => sum + row.count, 0),
				})),
				medianTimeToResolutionMs: median,
			};
		},
	),
	getTicketServiceRecords: capabilityProcedure(
		"ticket.read.all",
	).getTicketServiceRecords.handler(async ({ input }) => ({
		problems: (await listLinkedPublishedWorkarounds(input.ticketId)).map(
			(problem) => ({
				id: problem.problemId,
				problemNumber: problem.problemNumber,
				title: problem.title,
				workaround: problem.workaround,
				isKnownError: true,
			}),
		),
		changes: await db
			.select({
				id: changes.id,
				changeNumber: changes.changeNumber,
				title: changes.title,
				status: changes.status,
				changeType: changes.changeType,
			})
			.from(changeTicketLinks)
			.innerJoin(changes, eq(changeTicketLinks.changeId, changes.id))
			.where(eq(changeTicketLinks.ticketId, input.ticketId)),
	})),
};
