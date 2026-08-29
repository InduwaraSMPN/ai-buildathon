import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import {
	CATEGORY_NAMES,
	IMPACT_LEVELS,
	PRIORITIES,
	PROGRESS_MARKERS,
	RECORD_TYPES,
	TICKET_ROUTES,
	TICKET_STATUSES,
	URGENCY_LEVELS,
} from "@/shared";
import { user } from "./auth";
import { devices } from "./devices";

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
		deviceId: text("device_id").references(() => devices.id, {
			onDelete: "set null",
		}),

		title: text("title").notNull(),
		body: text("body").notNull(),
		recordType: text("record_type", { enum: RECORD_TYPES })
			.notNull()
			.default("incident"),
		impact: text("impact", { enum: IMPACT_LEVELS }).notNull().default("medium"),
		urgency: text("urgency", { enum: URGENCY_LEVELS })
			.notNull()
			.default("medium"),
		priority: text("priority", { enum: PRIORITIES }).notNull().default("P3"),
		category: text("category", { enum: CATEGORY_NAMES }),
		subcategory: text("subcategory"),

		// open -> routing -> resolving -> resolved | escalated | closed
		status: text("status", { enum: TICKET_STATUSES }).notNull().default("open"),
		route: text("route", { enum: TICKET_ROUTES }),
		resolution: text("resolution"),
		escalationNote: text("escalation_note"),
		reporterNote: text("reporter_note"),
		progressMarker: text("progress_marker", { enum: PROGRESS_MARKERS }),

		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		resolvedAt: timestamp("resolved_at"),
		closedAt: timestamp("closed_at"),
		reopenedAt: timestamp("reopened_at"),
		lastHumanTransitionAt: timestamp("last_human_transition_at"),
	},
	(t) => [
		index("tickets_reporter_idx").on(t.reporterId),
		index("tickets_status_idx").on(t.status, t.createdAt),
		index("tickets_priority_idx").on(t.priority, t.createdAt),
		index("tickets_type_idx").on(t.recordType, t.status),
		index("tickets_device_idx").on(t.deviceId),
	],
);

export const ticketTransitions = pgTable(
	"ticket_transitions",
	{
		id: text("id").primaryKey(),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		fromStatus: text("from_status", { enum: TICKET_STATUSES }).notNull(),
		toStatus: text("to_status", { enum: TICKET_STATUSES }).notNull(),
		action: text("action").notNull(),
		actorType: text("actor_type", { enum: ["human", "agent"] }).notNull(),
		actorId: text("actor_id"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [index("ticket_transitions_ticket_idx").on(t.ticketId, t.createdAt)],
);

export const ticketsRelations = relations(tickets, ({ one }) => ({
	reporter: one(user, {
		fields: [tickets.reporterId],
		references: [user.id],
	}),
}));
