import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const WORKFLOW_EXECUTION_STATUSES = [
	"running",
	"succeeded",
	"failed",
] as const;
export const WEBHOOK_DELIVERY_STATUSES = [
	"pending",
	"delivering",
	"succeeded",
	"retrying",
	"failed",
] as const;

export const workflows = pgTable(
	"workflows",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		triggerEvent: text("trigger_event").notNull(),
		conditions: jsonb("conditions")
			.$type<readonly unknown[]>()
			.notNull()
			.default([]),
		actions: jsonb("actions").$type<readonly unknown[]>().notNull().default([]),
		isActive: boolean("is_active").notNull().default(true),
		lastRunStatus: text("last_run_status", {
			enum: WORKFLOW_EXECUTION_STATUSES,
		}),
		lastRunAt: timestamp("last_run_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [index("workflows_trigger_idx").on(t.isActive, t.triggerEvent)],
);

export const workflowExecutions = pgTable(
	"workflow_executions",
	{
		id: text("id").primaryKey(),
		workflowId: text("workflow_id")
			.notNull()
			.references(() => workflows.id, { onDelete: "cascade" }),
		triggerEvent: text("trigger_event").notNull(),
		recordType: text("record_type").notNull(),
		recordId: text("record_id").notNull(),
		status: text("status", { enum: WORKFLOW_EXECUTION_STATUSES })
			.notNull()
			.default("running"),
		input: jsonb("input"),
		output: jsonb("output"),
		error: text("error"),
		startedAt: timestamp("started_at").defaultNow().notNull(),
		claimedAt: timestamp("claimed_at"),
		leaseExpiresAt: timestamp("lease_expires_at"),
		finishedAt: timestamp("finished_at"),
	},
	(t) => [
		index("workflow_executions_workflow_idx").on(t.workflowId, t.startedAt),
		index("workflow_executions_record_idx").on(t.recordType, t.recordId),
		index("workflow_executions_expired_lease_idx")
			.on(t.leaseExpiresAt)
			.where(sql`${t.status} = 'running'`),
	],
);

export const webhookDeliveries = pgTable(
	"webhook_deliveries",
	{
		id: text("id").primaryKey(),
		executionId: text("execution_id").references(() => workflowExecutions.id, {
			onDelete: "set null",
		}),
		url: text("url").notNull(),
		requestHeaders: jsonb("request_headers")
			.$type<Record<string, string>>()
			.notNull()
			.default({}),
		requestBody: text("request_body").notNull(),
		status: text("status", { enum: WEBHOOK_DELIVERY_STATUSES })
			.notNull()
			.default("pending"),
		attemptCount: integer("attempt_count").notNull().default(0),
		maxAttempts: integer("max_attempts").notNull().default(5),
		nextAttemptAt: timestamp("next_attempt_at"),
		responseStatus: integer("response_status"),
		responseHeaders: jsonb("response_headers").$type<Record<string, string>>(),
		responseBody: text("response_body"),
		lastError: text("last_error"),
		claimedAt: timestamp("claimed_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		completedAt: timestamp("completed_at"),
	},
	(t) => [
		index("webhook_deliveries_due_idx").on(t.status, t.nextAttemptAt),
		index("webhook_deliveries_execution_idx").on(t.executionId, t.createdAt),
		index("webhook_deliveries_delivering_idx")
			.on(t.claimedAt)
			.where(sql`${t.status} = 'delivering'`),
		check(
			"webhook_deliveries_attempt_count_nonnegative",
			sql`${t.attemptCount} >= 0`,
		),
		check(
			"webhook_deliveries_max_attempts_positive",
			sql`${t.maxAttempts} > 0`,
		),
		check(
			"webhook_deliveries_attempts_bounded",
			sql`${t.attemptCount} <= ${t.maxAttempts}`,
		),
	],
);
