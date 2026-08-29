import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { tickets } from "./tickets";

export const pendingReasons = pgTable(
	"pending_reasons",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		followupFrequencyMinutes: integer("followup_frequency_minutes").notNull(),
		followupsBeforeResolution: integer("followups_before_resolution").notNull(),
	},
	(t) => [
		check(
			"pending_reasons_frequency_positive",
			sql`${t.followupFrequencyMinutes} > 0`,
		),
		check(
			"pending_reasons_followups_positive",
			sql`${t.followupsBeforeResolution} > 0`,
		),
	],
);

export const pendingFollowups = pgTable(
	"pending_followups",
	{
		id: text("id").primaryKey(),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		reasonId: text("reason_id")
			.notNull()
			.references(() => pendingReasons.id),
		ordinal: integer("ordinal").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [index("pending_followups_ticket_idx").on(t.ticketId, t.createdAt)],
);
