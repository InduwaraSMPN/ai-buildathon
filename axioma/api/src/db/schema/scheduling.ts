import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { tickets } from "./tickets";

export const RECURRENCE_FREQUENCIES = ["daily", "weekly", "monthly"] as const;

/** Scheduling is isolated from tickets until its migration can safely add columns. */
export const ticketScheduling = pgTable(
	"ticket_scheduling",
	{
		ticketId: text("ticket_id")
			.primaryKey()
			.references(() => tickets.id, { onDelete: "cascade" }),
		workStartAt: timestamp("work_start_at"),
		workEndAt: timestamp("work_end_at"),
		workAllDay: boolean("work_all_day").notNull().default(false),
		snoozedUntil: timestamp("snoozed_until"),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		index("ticket_scheduling_calendar_idx").on(t.workStartAt, t.workEndAt),
		index("ticket_scheduling_snooze_idx").on(t.snoozedUntil),
		check(
			"ticket_scheduling_work_range_check",
			sql`(${t.workStartAt} IS NULL AND ${t.workEndAt} IS NULL) OR (${t.workStartAt} IS NOT NULL AND ${t.workEndAt} IS NOT NULL AND ${t.workEndAt} >= ${t.workStartAt})`,
		),
	],
);

export const recurringTickets = pgTable(
	"recurring_tickets",
	{
		id: text("id").primaryKey(),
		sourceTicketId: text("source_ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		frequency: text("frequency", { enum: RECURRENCE_FREQUENCIES }).notNull(),
		interval: integer("interval").notNull().default(1),
		startsAt: timestamp("starts_at").notNull(),
		until: timestamp("until"),
		enabled: boolean("enabled").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		index("recurring_tickets_due_idx").on(t.enabled, t.startsAt),
		index("recurring_tickets_source_ticket_id_idx").on(t.sourceTicketId),
		check("recurring_tickets_interval_positive", sql`${t.interval} > 0`),
		check(
			"recurring_tickets_until_check",
			sql`${t.until} IS NULL OR ${t.until} >= ${t.startsAt}`,
		),
	],
);

/** Claim this row before creating the ticket; the unique key makes retries harmless. */
export const recurringTicketOccurrences = pgTable(
	"recurring_ticket_occurrences",
	{
		id: text("id").primaryKey(),
		recurringTicketId: text("recurring_ticket_id")
			.notNull()
			.references(() => recurringTickets.id, { onDelete: "cascade" }),
		occursAt: timestamp("occurs_at").notNull(),
		idempotencyKey: text("idempotency_key").notNull(),
		generatedTicketId: text("generated_ticket_id").references(
			() => tickets.id,
			{
				onDelete: "set null",
			},
		),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("recurring_ticket_occurrences_slot_uidx").on(
			t.recurringTicketId,
			t.occursAt,
		),
		uniqueIndex("recurring_ticket_occurrences_key_uidx").on(t.idempotencyKey),
		index("recurring_ticket_occurrences_ticket_idx").on(t.generatedTicketId),
	],
);
