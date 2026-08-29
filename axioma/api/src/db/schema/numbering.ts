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
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("ticket_number_history_ticket_idx").on(t.ticketId, t.createdAt),
	],
);
