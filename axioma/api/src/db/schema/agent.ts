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

import { EVIDENCE_TONES, RUN_STATUSES, STEP_KINDS } from "@/shared";
import { user } from "./auth";
import { environments } from "./environments";
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
		// The person who started this run, when one did. Auto-dispatch leaves it
		// null. It exists so a device command proposed by a run cannot be
		// authorised by whoever set that run going.
		startedById: text("started_by_id").references(() => user.id, {
			onDelete: "set null",
		}),
		status: text("status", { enum: RUN_STATUSES }).notNull().default("running"),
		model: text("model"),
		outcome: text("outcome"),
		workerId: text("worker_id"),
		acceptedAt: timestamp("accepted_at"),
		leaseExpiresAt: timestamp("lease_expires_at"),

		// Resolved environment and how it was chosen; `environmentKey` is the
		// stable key denormalised for the dashboard run list without a join.
		environmentId: text("environment_id").references(() => environments.id, {
			onDelete: "set null",
		}),
		environmentKey: text("environment_key"),
		environmentSource: text("environment_source", {
			enum: ["ticket", "cmdb", "default"],
		}),

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
		index("agent_runs_ended_at_idx").on(t.endedAt),
		index("agent_runs_environment_idx").on(t.environmentId),
		index("agent_runs_started_by_idx").on(t.startedById),
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
		// Informational messages that are not failures; empty means absent.
		notice: text("notice").notNull().default(""),
		// Presentation tone for the evidence alert; neutral means no signal.
		evidenceTone: text("evidence_tone", { enum: EVIDENCE_TONES })
			.notNull()
			.default("neutral"),
		// The write tool this read discharged the verification obligation for.
		// Null on every other step, including a read that names the same tool but
		// confirmed nothing. The API sets it from its own obligation tracking, so
		// a step claiming a verification is a claim the change ledger agrees with
		// rather than one the model made about itself.
		verifiesTool: text("verifies_tool"),

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
