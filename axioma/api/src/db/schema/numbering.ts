import {
	bigint,
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { tickets } from "./tickets";

export const ticketNumberCounters = pgTable(
	"ticket_number_counters",
	{
		prefix: text("prefix").notNull(),
		year: text("year").notNull(),
		lastValue: bigint("last_value", { mode: "number" }).notNull(),
	},
	(t) => [primaryKey({ columns: [t.prefix, t.year] })],
);

export const ticketNumberHistory = pgTable(
	"ticket_number_history",
	{
		number: text("number").primaryKey(),
		// Cascades with the ticket. RESTRICT here made deleting a user impossible:
		// `tickets.reporter_id` cascades from `user`, but RESTRICT fires
		// unconditionally, so the cascade could never reach this row.
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("ticket_number_history_ticket_idx").on(t.ticketId, t.createdAt),
	],
);
