import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { RUN_STATUSES, STEP_KINDS } from "@/shared";
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
		status: text("status", { enum: RUN_STATUSES }).notNull().default("running"),
		model: text("model"),
		outcome: text("outcome"),
		workerId: text("worker_id"),
		acceptedAt: timestamp("accepted_at"),
		leaseExpiresAt: timestamp("lease_expires_at"),

		promptTokens: integer("prompt_tokens"),
		completionTokens: integer("completion_tokens"),

		startedAt: timestamp("started_at").defaultNow().notNull(),
		endedAt: timestamp("ended_at"),
	},
	(t) => [
		index("agent_runs_ticket_idx").on(t.ticketId, t.startedAt),
		index("agent_runs_expired_lease_idx")
			.on(t.leaseExpiresAt)
			.where(sql`${t.status} = 'running'`),
	],
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
		// think | tool_call | observation | decision | terminal
		kind: text("kind", { enum: STEP_KINDS }).notNull(),

		reasoning: text("reasoning"),
		toolName: text("tool_name"),
		toolInput: jsonb("tool_input"),
		toolOutput: jsonb("tool_output"),
		error: text("error"),
		evidence: text("evidence"),

		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("agent_steps_run_ordinal_uidx").on(t.runId, t.ordinal)],
);

export const agentToolCalls = pgTable(
	"agent_tool_calls",
	{
		id: text("id").primaryKey(),
		runId: text("run_id")
			.notNull()
			.references(() => agentRuns.id, { onDelete: "cascade" }),
		callId: text("call_id").notNull(),
		status: text("status", { enum: ["in_progress", "succeeded", "failed"] })
			.notNull()
			.default("in_progress"),
		result: jsonb("result"),
		error: text("error"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		finishedAt: timestamp("finished_at"),
	},
	(t) => [uniqueIndex("agent_tool_calls_run_call_uidx").on(t.runId, t.callId)],
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
