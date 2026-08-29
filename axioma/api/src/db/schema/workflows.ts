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
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const WORKFLOW_EXECUTION_STATUSES = [
	"running",
	"succeeded",
	"failed",
] as const;
export const SCHEDULED_EMISSION_STATUSES = [
	"pending",
	"emitted",
	"cancelled",
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
		finishedAt: timestamp("finished_at"),
	},
	(t) => [
		index("workflow_executions_workflow_idx").on(t.workflowId, t.startedAt),
		index("workflow_executions_record_idx").on(t.recordType, t.recordId),
	],
);

export const workflowScheduledEmissions = pgTable(
	"workflow_scheduled_emissions",
	{
		id: text("id").primaryKey(),
		workflowId: text("workflow_id")
			.notNull()
			.references(() => workflows.id, { onDelete: "cascade" }),
		executionId: text("execution_id").references(() => workflowExecutions.id, {
			onDelete: "set null",
		}),
		idempotencyKey: text("idempotency_key").notNull(),
		recordType: text("record_type").notNull(),
		recordId: text("record_id").notNull(),
		emitAt: timestamp("emit_at").notNull(),
		payload: jsonb("payload").notNull(),
		status: text("status", { enum: SCHEDULED_EMISSION_STATUSES })
			.notNull()
			.default("pending"),
		emittedAt: timestamp("emitted_at"),
		error: text("error"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("workflow_scheduled_emissions_idempotency_uidx").on(
			t.idempotencyKey,
		),
		index("workflow_scheduled_emissions_due_idx").on(t.status, t.emitAt),
	],
);

export const webhookMessageFormats = pgTable("webhook_message_formats", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	contentType: text("content_type").notNull().default("application/json"),
	bodyTemplate: text("body_template").notNull(),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const webhookDeliveries = pgTable(
	"webhook_deliveries",
	{
		id: text("id").primaryKey(),
		executionId: text("execution_id").references(() => workflowExecutions.id, {
			onDelete: "set null",
		}),
		messageFormatId: text("message_format_id").references(
			() => webhookMessageFormats.id,
			{ onDelete: "set null" },
		),
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
		createdAt: timestamp("created_at").defaultNow().notNull(),
		completedAt: timestamp("completed_at"),
	},
	(t) => [
		index("webhook_deliveries_due_idx").on(t.status, t.nextAttemptAt),
		index("webhook_deliveries_execution_idx").on(t.executionId, t.createdAt),
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
