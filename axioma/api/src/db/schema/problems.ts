import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { PRIORITIES } from "@/shared";
import { user } from "./auth";
import { services } from "./catalogue";
import { tickets } from "./tickets";
import { ticketStatuses } from "./vocabulary";

export const problems = pgTable(
	"problems",
	{
		id: text("id").primaryKey(),
		problemNumber: text("problem_number").notNull(),
		title: text("title").notNull(),
		description: text("description").notNull(),
		status: text("status")
			.notNull()
			.default("open")
			.references(() => ticketStatuses.key),
		priority: text("priority", { enum: PRIORITIES }).notNull().default("P3"),
		assigneeId: text("assignee_id").references(() => user.id, {
			onDelete: "set null",
		}),
		rootCause: text("root_cause"),
		workaround: text("workaround"),
		isKnownError: boolean("is_known_error").notNull().default(false),
		serviceId: text("service_id").references(() => services.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("problems_number_uidx").on(t.problemNumber),
		index("problems_status_priority_idx").on(t.status, t.priority),
		index("problems_assignee_idx").on(t.assigneeId),
		index("problems_service_idx").on(t.serviceId),
		index("problems_known_error_idx").on(t.isKnownError, t.status),
		index("problems_updated_at_idx").on(t.updatedAt),
	],
);

export const problemTickets = pgTable(
	"problem_tickets",
	{
		problemId: text("problem_id")
			.notNull()
			.references(() => problems.id, { onDelete: "cascade" }),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.problemId, t.ticketId] }),
		index("problem_tickets_ticket_idx").on(t.ticketId),
	],
);

export const problemsRelations = relations(problems, ({ many, one }) => ({
	assignee: one(user, {
		fields: [problems.assigneeId],
		references: [user.id],
	}),
	service: one(services, {
		fields: [problems.serviceId],
		references: [services.id],
	}),
	tickets: many(problemTickets),
}));

export const problemTicketsRelations = relations(problemTickets, ({ one }) => ({
	problem: one(problems, {
		fields: [problemTickets.problemId],
		references: [problems.id],
	}),
	ticket: one(tickets, {
		fields: [problemTickets.ticketId],
		references: [tickets.id],
	}),
}));
