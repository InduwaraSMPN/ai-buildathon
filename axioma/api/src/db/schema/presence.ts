import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { tickets } from "./tickets";

export const ticketPresence = pgTable(
	"ticket_presence",
	{
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
		expiresAt: timestamp("expires_at").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.ticketId, t.userId] }),
		index("ticket_presence_expiry_idx").on(t.ticketId, t.expiresAt),
	],
);

export const ticketCsatResponses = pgTable(
	"ticket_csat_responses",
	{
		id: text("id").primaryKey(),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		token: text("token").notNull(),
		rating: integer("rating"),
		comment: text("comment"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		respondedAt: timestamp("responded_at"),
	},
	(t) => [
		uniqueIndex("ticket_csat_ticket_idx").on(t.ticketId),
		uniqueIndex("ticket_csat_token_idx").on(t.token),
		check(
			"ticket_csat_rating_bounds",
			sql`${t.rating} is null or (${t.rating} >= 1 and ${t.rating} <= 5)`,
		),
		check(
			"ticket_csat_response_complete",
			sql`(${t.rating} is null and ${t.respondedAt} is null) or (${t.rating} is not null and ${t.respondedAt} is not null)`,
		),
	],
);

export const ticketPresenceRelations = relations(ticketPresence, ({ one }) => ({
	ticket: one(tickets, {
		fields: [ticketPresence.ticketId],
		references: [tickets.id],
	}),
	user: one(user, { fields: [ticketPresence.userId], references: [user.id] }),
}));

export const ticketCsatRelations = relations(
	ticketCsatResponses,
	({ one }) => ({
		ticket: one(tickets, {
			fields: [ticketCsatResponses.ticketId],
			references: [tickets.id],
		}),
	}),
);
