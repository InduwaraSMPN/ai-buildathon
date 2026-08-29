import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { tickets } from "./tickets";

export const ticketAudit = pgTable(
	"ticket_audit",
	{
		id: text("id").primaryKey(),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		fieldName: text("field_name").notNull(),
		oldValue: jsonb("old_value"),
		newValue: jsonb("new_value"),
		actorId: text("actor_id").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [index("ticket_audit_ticket_idx").on(t.ticketId, t.createdAt)],
);

export const ticketTimeEntries = pgTable(
	"ticket_time_entries",
	{
		id: text("id").primaryKey(),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		userId: text("user_id").notNull(),
		minutes: integer("minutes").notNull(),
		note: text("note").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("ticket_time_entries_ticket_idx").on(t.ticketId, t.createdAt),
		check("ticket_time_entries_minutes_positive", sql`${t.minutes} > 0`),
	],
);
