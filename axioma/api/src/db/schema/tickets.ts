import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * A support request opened by an employee.
 *
 * `route` is the team or system Axel decided owns this, and stays null until
 * routing runs. `resolution` explains the outcome in the employee's terms and is
 * written for both closure and escalation.
 */
export const tickets = pgTable(
	"tickets",
	{
		id: text("id").primaryKey(),
		reporterId: text("reporter_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		deviceId: text("device_id"),

		title: text("title").notNull(),
		body: text("body").notNull(),

		// open -> routing -> resolving -> resolved | escalated | closed
		status: text("status").notNull().default("open"),
		route: text("route"),
		resolution: text("resolution"),

		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		closedAt: timestamp("closed_at"),
	},
	(t) => [
		index("tickets_reporter_idx").on(t.reporterId),
		index("tickets_status_idx").on(t.status, t.createdAt),
	],
);

export const ticketsRelations = relations(tickets, ({ one }) => ({
	reporter: one(user, {
		fields: [tickets.reporterId],
		references: [user.id],
	}),
}));
