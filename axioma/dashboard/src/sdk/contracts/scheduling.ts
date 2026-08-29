// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

import { oc } from "@orpc/contract";
import { z } from "zod";

const recurrence = z.object({
	id: z.string(),
	sourceTicketId: z.string(),
	frequency: z.enum(["daily", "weekly", "monthly"]),
	interval: z.number().int().positive(),
	startsAt: z.date(),
	until: z.date().nullable(),
	enabled: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const recurrenceInput = recurrence.pick({
	sourceTicketId: true,
	frequency: true,
	interval: true,
	startsAt: true,
	until: true,
	enabled: true,
});

const schedule = z.object({
	ticketId: z.string(),
	workStartAt: z.date().nullable(),
	workEndAt: z.date().nullable(),
	workAllDay: z.boolean(),
	snoozedUntil: z.date().nullable(),
	updatedAt: z.date(),
});

const scheduledTicket = schedule.extend({
	ticketNumber: z.string().nullable(),
	title: z.string(),
	status: z.string(),
	priority: z.enum(["P1", "P2", "P3", "P4"]),
});

export const schedulingContract = {
	setTicketSchedule: oc
		.input(
			z.object({
				ticketId: z.string().min(1),
				workStartAt: z.coerce.date().nullable(),
				durationMinutes: z.number().int().min(0).max(525_600),
				workAllDay: z.boolean().default(false),
			}),
		)
		.output(scheduledTicket),
	snoozeTicket: oc
		.input(
			z.object({
				ticketId: z.string().min(1),
				until: z.coerce.date().nullable(),
			}),
		)
		.output(scheduledTicket),
	listCalendar: oc
		.input(z.object({ from: z.coerce.date(), to: z.coerce.date() }))
		.output(z.array(scheduledTicket)),
	listRecurrences: oc.output(z.array(recurrence)),
	createRecurrence: oc.input(recurrenceInput).output(recurrence),
	updateRecurrence: oc
		.input(recurrenceInput.partial().extend({ id: z.string().min(1) }))
		.output(recurrence),
	deleteRecurrence: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(z.object({ deleted: z.boolean() })),
	triggerRecurrences: oc
		.input(
			z.object({
				now: z.coerce.date().default(() => new Date()),
				limit: z.number().int().min(1).max(1000).default(100),
			}),
		)
		.output(
			z.object({
				created: z.number().int().nonnegative(),
				skipped: z.number().int().nonnegative(),
			}),
		),
};
