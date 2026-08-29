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
	pendingReasons,
	services,
	ticketAudit,
	ticketCsatResponses,
	ticketLinks,
	ticketMerges,
	ticketMessages,
	ticketNumberCounters,
	ticketNumberHistory,
	ticketPresence,
	ticketRuleFirings,
	ticketRules,
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
	CATEGORY_NAMES,
	derivePriority,
	PRIORITIES,
	RECORD_TYPES,
	RESOLUTION_CODES,
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
import { evaluateTicketRules } from "../rules";
import { indexTicket } from "../search/projections";
import {
	attachTicketStopwatches,
	transitionTicketStopwatches,
} from "../sla/runtime";
import { auditChanges, formatTicketNumber } from "../ticket-records";
import { preserveUndefined, resolveTicketStatus } from "../tickets";
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
	title: tickets.title,
	body: tickets.body,
	recordType: tickets.recordType,
	impact: tickets.impact,
	urgency: tickets.urgency,
	priority: tickets.priority,
	serviceId: tickets.serviceId,
	serviceSubcategoryId: tickets.serviceSubcategoryId,
	category: tickets.category,
	subcategory: tickets.subcategory,
	status: tickets.status,
	statusLabel: sql<string>`(select label from ${ticketStatuses} where key = ${tickets.status})`,
	statusStateType: sql<string>`(select state_type from ${ticketStatuses} where key = ${tickets.status})`,
	statusColour: sql<
		string | null
	>`(select colour from ${ticketStatuses} where key = ${tickets.status})`,
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
			const id = crypto.randomUUID();
			const evaluation = evaluateTicketRules(
				{
					title: input.title,
					body: input.body,
					requesterId: context.userId,
					recordType: input.recordType,
					impact: input.impact,
					urgency: input.urgency,
				},
				await db
					.select()
					.from(ticketRules)
					.where(eq(ticketRules.enabled, true)),
			);
			const settled = evaluation.ticket;
			const year = String(new Date().getUTCFullYear());
			const prefix = settled.recordType === "incident" ? "INC" : "REQ";
			await db.transaction(async (tx) => {
				const counter = (
					await tx
						.insert(ticketNumberCounters)
						.values({ prefix, year, lastValue: 1 })
						.onConflictDoUpdate({
							target: [ticketNumberCounters.prefix, ticketNumberCounters.year],
							set: { lastValue: sql`${ticketNumberCounters.lastValue} + 1` },
						})
						.returning({ value: ticketNumberCounters.lastValue })
				)[0];
				if (!counter) throw new ORPCError("INTERNAL_SERVER_ERROR");
				const number = formatTicketNumber(
					settled.recordType,
					Number(year),
					counter.value,
				);
				await tx.insert(tickets).values({
					id,
					number,
					reporterId: context.userId,
					deviceId,
					title: input.title,
					body: input.body,
					recordType: settled.recordType,
					impact: settled.impact,
					urgency: settled.urgency,
					priority: derivePriority(settled.impact, settled.urgency),
					serviceId: input.serviceId ?? "svc-general",
					serviceSubcategoryId: input.serviceSubcategoryId ?? "ss-general",
					category: settled.category,
					route: settled.route,
					teamId: settled.teamId,
					assigneeId: settled.assigneeId,
				});
				await tx.insert(ticketNumberHistory).values({ number, ticketId: id });
				if (evaluation.firings.length) {
					await tx.insert(ticketRuleFirings).values(
						evaluation.firings.map((firing) => ({
							id: crypto.randomUUID(),
							ticketId: id,
							ruleId: firing.ruleId,
							rulePosition: firing.rulePosition,
							result: firing,
						})),
					);
					await tx.insert(ticketAudit).values(
						evaluation.firings.flatMap((firing) =>
							firing.applied.map((action) => ({
								id: crypto.randomUUID(),
								ticketId: id,
								fieldName: action.type,
								oldValue: null,
								newValue: "value" in action ? action.value : true,
								actorId: `rule:${firing.ruleId}`,
							})),
						),
					);
				}
			});
			await attachTicketStopwatches(
				id,
				derivePriority(settled.impact, settled.urgency),
			);
			if (Object.keys(input.customFields).length)
				await writeDynamicFieldValues(db, "ticket", id, input.customFields);
			await indexTicket(db, id);
			void fireEvent({
				type: "ticket.created",
				source: "ticket",
				recordType: "ticket",
				recordId: id,
				actorId: context.userId,
				payload: { number: prefix, settledActions: evaluation.settledActions },
			});
			let created = await findTicket(id);
			if (!created) throw new ORPCError("INTERNAL_SERVER_ERROR");
			if (env.AXIOMA_AUTO_DISPATCH && grpcGateway.hasWorker()) {
				await startTicketRun(created);
				created = await findTicket(id);
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
		const filters = [
			sql`not exists (
				select 1 from ${ticketScheduling}
				where ${ticketScheduling.ticketId} = ${tickets.id}
					and ${ticketScheduling.snoozedUntil} > now()
			)`,
			input.scope === "mine"
				? eq(tickets.reporterId, context.userId)
				: undefined,
			input.myQueue
				? or(
						eq(tickets.assigneeId, context.userId),
						sql`${tickets.teamId} in (select ${teamMembers.teamId} from ${teamMembers} where ${teamMembers.userId} = ${context.userId})`,
					)
				: undefined,
			input.assigneeId ? eq(tickets.assigneeId, input.assigneeId) : undefined,
			input.teamId ? eq(tickets.teamId, input.teamId) : undefined,
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
				? eq(tickets.reporterId, context.userId)
				: undefined;
		const [
			statusDefinitions,
			statuses,
			priorities,
			recordTypes,
			serviceFacets,
			categories,
			routes,
			assignees,
			ticketTeams,
		] = await Promise.all([
			db
				.select({ key: ticketStatuses.key })
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
				status: statusDefinitions.map(({ key: value }) => ({
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
				service: serviceFacets,
				category: [...CATEGORY_NAMES, null].map((value) => ({
					value,
					count: categories.find((row) => row.value === value)?.count ?? 0,
				})),
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
		if (!(await findTicket(input.ticketId, context.userId)))
			throw new ORPCError("NOT_FOUND");
		const [message] = await db
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
		await db
			.update(tickets)
			.set({
				status: "open",
				pendingReasonId: null,
				pendingUntil: null,
				lastPendingAt: null,
				updatedAt: new Date(),
			})
			.where(
				and(eq(tickets.id, input.ticketId), eq(tickets.status, "pending")),
			);
		await transitionTicketStopwatches(input.ticketId, "open");
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
				return (
					await db
						.insert(ticketLinks)
						.values({
							id: crypto.randomUUID(),
							...input,
							createdBy: context.userId,
						})
						.returning()
				)[0]!;
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
			return (await findTicket(input.sourceTicketId))!;
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
			return (await findTicket(input.sourceTicketId))!;
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
		return (
			await db
				.insert(ticketTimeEntries)
				.values({
					id: crypto.randomUUID(),
					ticketId: input.ticketId,
					userId: context.userId,
					minutes: input.minutes,
					note: input.note,
				})
				.returning()
		)[0]!;
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
		assertCapabilities(context, required[input.action]);
		const current = await findTicket(input.id);
		if (!current) throw new ORPCError("NOT_FOUND");
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
		if (input.action === "pend" && !pendingReason)
			throw new ORPCError("BAD_REQUEST", {
				message: "Unknown pending reason",
			});
		const nextStatus = await resolveTicketStatus(current.status, input.action);
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
				pendingUntil:
					input.action === "pend"
						? (input.until ??
							nextPendingFollowupAt(
								now,
								pendingReason!.followupFrequencyMinutes,
							))
						: input.action === "unpend"
							? null
							: current.pendingUntil,
				lastPendingAt: input.action === "pend" ? now : current.lastPendingAt,
				pendingFollowups:
					input.action === "pend" ? 0 : current.pendingFollowups,
				lastHumanTransitionAt: now,
				updatedAt: now,
			})
			.where(and(eq(tickets.id, input.id), eq(tickets.status, current.status)))
			.returning({ id: tickets.id });
		if (!changed[0])
			throw new ORPCError("CONFLICT", {
				message: "Ticket changed while it was being updated",
			});
		if (nextStatus !== current.status)
			await transitionTicketStopwatches(input.id, nextStatus, now);
		if (input.action === "add_detail")
			await db.insert(ticketMessages).values({
				id: crypto.randomUUID(),
				ticketId: input.id,
				authorId: context.userId,
				authorType: "reporter",
				body: input.note,
				visibility: "public",
			});
		if (input.action === "close")
			await db
				.insert(ticketCsatResponses)
				.values({
					id: crypto.randomUUID(),
					ticketId: input.id,
					token: `${crypto.randomUUID()}${crypto.randomUUID()}`,
				})
				.onConflictDoNothing({ target: ticketCsatResponses.ticketId });
		if (nextStatus !== current.status)
			await db.insert(ticketTransitions).values({
				id: crypto.randomUUID(),
				ticketId: input.id,
				fromStatus: current.status,
				toStatus: nextStatus,
				action: input.action,
				actorType: "human",
				actorId: context.userId,
			});
		const updated = await findTicket(input.id);
		if (!updated) throw new ORPCError("NOT_FOUND");
		await indexTicket(db, input.id);
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
		});
		const changes = auditChanges(
			{
				recordType: current.recordType,
				impact: current.impact,
				urgency: current.urgency,
				priority: current.priority,
				category: current.category,
				subcategory: current.subcategory,
				route: current.route,
			},
			{
				recordType: updated.recordType,
				impact: updated.impact,
				urgency: updated.urgency,
				priority: updated.priority,
				category: updated.category,
				subcategory: updated.subcategory,
				route: updated.route,
			},
		);
		if (changes.length)
			await db.insert(ticketAudit).values(
				changes.map((change) => ({
					id: crypto.randomUUID(),
					ticketId: input.id,
					actorId: context.userId,
					...change,
				})),
			);
		return updated;
	}),
	ticketStats: capabilityProcedure("stats.read").ticketStats.handler(
		async ({ input }) => {
			const since = new Date(Date.now() - (input.days - 1) * 86_400_000);
			since.setUTCHours(0, 0, 0, 0);
			const escalatedSince = new Date(Date.now() - 86_400_000);
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
				closedRows,
				humanTransitionRows,
				csatRows,
			] = await Promise.all([
				db
					.select({ key: ticketStatuses.key })
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
				db
					.select({ rating: ticketCsatResponses.rating, count: count() })
					.from(ticketCsatResponses)
					.where(sql`${ticketCsatResponses.rating} is not null`)
					.groupBy(ticketCsatResponses.rating),
			]);
			const dates = Array.from({ length: input.days }, (_, index) =>
				new Date(since.getTime() + index * 86_400_000)
					.toISOString()
					.slice(0, 10),
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
			const csatResponses = csatRows.reduce((sum, row) => sum + row.count, 0);
			const csatTotal = csatRows.reduce(
				(sum, row) => sum + (row.rating ?? 0) * row.count,
				0,
			);
			const autonomousClosed = Math.max(
				0,
				closedTotal - (humanTransitionRows[0]?.count ?? 0),
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
						.filter((row) => row.date === date && row.status === "resolved")
						.reduce((sum, row) => sum + row.count, 0),
					escalated: outcomeDaily
						.filter((row) => row.date === date && row.status === "escalated")
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
