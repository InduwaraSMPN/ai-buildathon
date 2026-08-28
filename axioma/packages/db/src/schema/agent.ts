import { relations } from "drizzle-orm";
import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { tickets } from "./tickets";

/**
 * One attempt by Axel to resolve a ticket.
 *
 * `model` records which model actually answered rather than which one was
 * configured, so a run stays interpretable after the configuration changes.
 */
export const agentRuns = pgTable(
	"agent_runs",
	{
		id: text("id").primaryKey(),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),

		// running -> resolved | escalated | failed | exhausted
		status: text("status").notNull().default("running"),
		model: text("model"),
		outcome: text("outcome"),

		promptTokens: integer("prompt_tokens"),
		completionTokens: integer("completion_tokens"),

		startedAt: timestamp("started_at").defaultNow().notNull(),
		endedAt: timestamp("ended_at"),
	},
	(t) => [index("agent_runs_ticket_idx").on(t.ticketId, t.startedAt)],
);

/**
 * The transcript. One row per step, written as the step happens rather than at
 * the end of the run, so a run that hangs still shows how far it got.
 */
export const agentSteps = pgTable(
	"agent_steps",
	{
		id: text("id").primaryKey(),
		runId: text("run_id")
			.notNull()
			.references(() => agentRuns.id, { onDelete: "cascade" }),

		ordinal: integer("ordinal").notNull(),
		// think | tool_call | observation | decision
		kind: text("kind").notNull(),

		reasoning: text("reasoning"),
		toolName: text("tool_name"),
		toolInput: jsonb("tool_input"),
		toolOutput: jsonb("tool_output"),
		error: text("error"),

		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [index("agent_steps_run_idx").on(t.runId, t.ordinal)],
);

export const agentRunsRelations = relations(agentRuns, ({ one, many }) => ({
	ticket: one(tickets, {
		fields: [agentRuns.ticketId],
		references: [tickets.id],
	}),
	steps: many(agentSteps),
}));

export const agentStepsRelations = relations(agentSteps, ({ one }) => ({
	run: one(agentRuns, {
		fields: [agentSteps.runId],
		references: [agentRuns.id],
	}),
}));
