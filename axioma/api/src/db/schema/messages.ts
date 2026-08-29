import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { tickets } from "./tickets";

export const ticketMessages = pgTable(
	"ticket_messages",
	{
		id: text("id").primaryKey(),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		authorId: text("author_id").references(() => user.id, {
			onDelete: "set null",
		}),
		authorType: text("author_type", { enum: ["reporter", "staff"] }).notNull(),
		body: text("body").notNull(),
		visibility: text("visibility", { enum: ["public", "private"] })
			.notNull()
			.default("public"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("ticket_messages_ticket_idx").on(t.ticketId, t.createdAt),
		index("ticket_messages_author_id_idx").on(t.authorId),
	],
);
