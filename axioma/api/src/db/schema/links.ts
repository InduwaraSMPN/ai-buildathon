import { sql } from "drizzle-orm";
import {
	check,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { tickets } from "./tickets";

export const TICKET_RELATION_TYPES = [
	"duplicate_of",
	"related_to",
	"caused_by",
	"parent_of",
] as const;

export const ticketLinks = pgTable(
	"ticket_links",
	{
		id: text("id").primaryKey(),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		targetTicketId: text("target_ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		relationType: text("relation_type", {
			enum: TICKET_RELATION_TYPES,
		}).notNull(),
		createdBy: text("created_by").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("ticket_links_relation_uidx").on(
			t.ticketId,
			t.targetTicketId,
			t.relationType,
		),
		index("ticket_links_target_idx").on(t.targetTicketId),
		check("ticket_links_not_self", sql`${t.ticketId} <> ${t.targetTicketId}`),
	],
);

export const ticketMerges = pgTable(
	"ticket_merges",
	{
		id: text("id").primaryKey(),
		// Both cascade for the same reason `ticket_number_history` does: RESTRICT
		// under a cascading parent is not a guard, it is a wall that makes the
		// parent undeletable.
		sourceTicketId: text("source_ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		targetTicketId: text("target_ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		sourcePreviousStatus: text("source_previous_status").notNull(),
		mergedBy: text("merged_by").notNull(),
		mergedAt: timestamp("merged_at").defaultNow().notNull(),
		undoneBy: text("undone_by"),
		undoneAt: timestamp("undone_at"),
	},
	(t) => [
		index("ticket_merges_source_idx").on(t.sourceTicketId, t.mergedAt),
		index("ticket_merges_target_idx").on(t.targetTicketId, t.mergedAt),
		check(
			"ticket_merges_not_self",
			sql`${t.sourceTicketId} <> ${t.targetTicketId}`,
		),
	],
);
