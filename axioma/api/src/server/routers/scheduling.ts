import { ORPCError } from "@orpc/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { recurringTickets, ticketScheduling, tickets } from "@/db/schema";
import { capabilityProcedure } from "../orpc";
import { endFromDuration } from "../scheduling";
import { generateDueRecurrences } from "../scheduling-runtime";

const requireTicketAccess = async (
	ticketId: string,
	userId: string,
	canReadAll: boolean,
) => {
	const [ticket] = await db
		.select({
			id: tickets.id,
			ticketNumber: tickets.number,
			title: tickets.title,
			status: tickets.status,
			priority: tickets.priority,
		})
		.from(tickets)
		.where(
			and(
				eq(tickets.id, ticketId),
				canReadAll ? undefined : eq(tickets.reporterId, userId),
			),
		)
		.limit(1);
	if (!ticket) throw new ORPCError("NOT_FOUND");
	return ticket;
};

export const schedulingRouter = {
	setTicketSchedule: capabilityProcedure(
		"ticket.reclassify",
	).setTicketSchedule.handler(async ({ context, input }) => {
		const ticket = await requireTicketAccess(
			input.ticketId,
			context.userId,
			context.capabilities.has("ticket.read.all"),
		);
		const [row] = await db
			.insert(ticketScheduling)
			.values({
				ticketId: input.ticketId,
				workStartAt: input.workStartAt,
				workEndAt: input.workStartAt
					? endFromDuration(input.workStartAt, input.durationMinutes)
					: null,
				workAllDay: input.workAllDay,
			})
			.onConflictDoUpdate({
				target: ticketScheduling.ticketId,
				set: {
					workStartAt: input.workStartAt,
					workEndAt: input.workStartAt
						? endFromDuration(input.workStartAt, input.durationMinutes)
						: null,
					workAllDay: input.workAllDay,
					updatedAt: new Date(),
				},
			})
			.returning();
		if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return { ...row, ...ticket };
	}),
	snoozeTicket: capabilityProcedure("ticket.reclassify").snoozeTicket.handler(
		async ({ context, input }) => {
			const ticket = await requireTicketAccess(
				input.ticketId,
				context.userId,
				context.capabilities.has("ticket.read.all"),
			);
			const [row] = await db
				.insert(ticketScheduling)
				.values({ ticketId: input.ticketId, snoozedUntil: input.until })
				.onConflictDoUpdate({
					target: ticketScheduling.ticketId,
					set: { snoozedUntil: input.until, updatedAt: new Date() },
				})
				.returning();
			if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
			return { ...row, ...ticket };
		},
	),
	listCalendar: capabilityProcedure("ticket.read.own").listCalendar.handler(
		async ({ context, input }) => {
			if (input.to < input.from)
				throw new ORPCError("BAD_REQUEST", {
					message: "Calendar end must follow start",
				});
			return db
				.select({
					ticketId: ticketScheduling.ticketId,
					ticketNumber: tickets.number,
					title: tickets.title,
					status: tickets.status,
					priority: tickets.priority,
					workStartAt: ticketScheduling.workStartAt,
					workEndAt: ticketScheduling.workEndAt,
					workAllDay: ticketScheduling.workAllDay,
					snoozedUntil: ticketScheduling.snoozedUntil,
					updatedAt: ticketScheduling.updatedAt,
				})
				.from(ticketScheduling)
				.innerJoin(tickets, eq(ticketScheduling.ticketId, tickets.id))
				.where(
					and(
						context.capabilities.has("ticket.read.all")
							? undefined
							: eq(tickets.reporterId, context.userId),
						lte(ticketScheduling.workStartAt, input.to),
						gte(ticketScheduling.workEndAt, input.from),
					),
				)
				.orderBy(ticketScheduling.workStartAt);
		},
	),
	listRecurrences: capabilityProcedure(
		"admin.settings",
	).listRecurrences.handler(() =>
		db.select().from(recurringTickets).orderBy(asc(recurringTickets.startsAt)),
	),
	createRecurrence: capabilityProcedure(
		"admin.settings",
	).createRecurrence.handler(async ({ input }) => {
		const [row] = await db
			.insert(recurringTickets)
			.values({ id: crypto.randomUUID(), ...input })
			.returning();
		return row!;
	}),
	updateRecurrence: capabilityProcedure(
		"admin.settings",
	).updateRecurrence.handler(async ({ input: { id, ...input } }) => {
		const [row] = await db
			.update(recurringTickets)
			.set({ ...input, updatedAt: new Date() })
			.where(eq(recurringTickets.id, id))
			.returning();
		if (!row) throw new ORPCError("NOT_FOUND");
		return row;
	}),
	deleteRecurrence: capabilityProcedure(
		"admin.settings",
	).deleteRecurrence.handler(async ({ input }) => ({
		deleted: Boolean(
			(
				await db
					.delete(recurringTickets)
					.where(eq(recurringTickets.id, input.id))
					.returning({ id: recurringTickets.id })
			)[0],
		),
	})),
	triggerRecurrences: capabilityProcedure(
		"admin.settings",
	).triggerRecurrences.handler(({ input }) =>
		generateDueRecurrences(input.now, input.limit),
	),
};
