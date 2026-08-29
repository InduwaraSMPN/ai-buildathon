import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const notifications = pgTable(
	"notifications",
	{
		id: text("id").primaryKey(),
		recipientId: text("recipient_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		actorId: text("actor_id").references(() => user.id, {
			onDelete: "set null",
		}),
		recordType: text("record_type").notNull(),
		recordId: text("record_id").notNull(),
		eventType: text("event_type").notNull(),
		eventCount: integer("event_count").notNull().default(1),
		title: text("title").notNull(),
		body: text("body").notNull(),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		readAt: timestamp("read_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("notifications_recipient_record_event_uidx").on(
			t.recipientId,
			t.recordType,
			t.recordId,
			t.eventType,
		),
		index("notifications_recipient_unread_idx").on(
			t.recipientId,
			t.readAt,
			t.updatedAt,
		),
		check("notifications_event_count_positive", sql`${t.eventCount} > 0`),
		check(
			"notifications_not_own_action",
			sql`${t.actorId} IS NULL OR ${t.actorId} <> ${t.recipientId}`,
		),
	],
);
