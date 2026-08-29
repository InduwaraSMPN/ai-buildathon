import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { PRIORITIES } from "@/shared";
import { calendars } from "./calendars";
import { tickets } from "./tickets";

export const POLICY_TYPES = ["sla", "ola"] as const;
export const SLA_TARGET_TYPES = ["response", "resolution"] as const;
export const SLA_TRIGGER_TYPES = ["warning", "breach"] as const;
export const SLA_NOTIFICATION_TARGET_TYPES = [
	...SLA_TARGET_TYPES,
	"both",
] as const;
export const SLA_RECIPIENT_TYPES = ["assignee", "team", "address"] as const;

const policyColumns = () => ({
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	priority: text("priority", { enum: PRIORITIES }),
	ttoWorkingMinutes: integer("tto_working_minutes").notNull(),
	ttrWorkingMinutes: integer("ttr_working_minutes").notNull(),
	calendarId: text("calendar_id")
		.notNull()
		.references(() => calendars.id),
	isDefault: boolean("is_default").notNull().default(false),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const slas = pgTable("slas", policyColumns(), (t) => [
	index("slas_priority_idx").on(t.priority),
	check("slas_tto_positive", sql`${t.ttoWorkingMinutes} > 0`),
	check("slas_ttr_positive", sql`${t.ttrWorkingMinutes} > 0`),
]);

export const olas = pgTable("olas", policyColumns(), (t) => [
	index("olas_priority_idx").on(t.priority),
	check("olas_tto_positive", sql`${t.ttoWorkingMinutes} > 0`),
	check("olas_ttr_positive", sql`${t.ttrWorkingMinutes} > 0`),
]);

/** One row per ticket, policy kind, and independently pausable target. */
export const ticketStopwatches = pgTable(
	"ticket_stopwatches",
	{
		id: text("id").primaryKey(),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		policyType: text("policy_type", { enum: POLICY_TYPES }).notNull(),
		// Polymorphic by policyType; validated when the policy snapshot is attached.
		policyId: text("policy_id").notNull(),
		targetType: text("target_type", { enum: SLA_TARGET_TYPES }).notNull(),
		accumulatedMs: bigint("accumulated_ms", { mode: "number" })
			.notNull()
			.default(0),
		pendingMs: bigint("pending_ms", { mode: "number" }).notNull().default(0),
		running: boolean("running").notNull().default(true),
		startedAt: timestamp("started_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("ticket_stopwatches_target_uidx").on(
			t.ticketId,
			t.policyType,
			t.targetType,
		),
		index("ticket_stopwatches_running_idx").on(t.running, t.startedAt),
		check(
			"ticket_stopwatches_accumulated_nonnegative",
			sql`${t.accumulatedMs} >= 0`,
		),
		check("ticket_stopwatches_pending_nonnegative", sql`${t.pendingMs} >= 0`),
	],
);

export const slaNotificationRules = pgTable(
	"sla_notification_rules",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		policyType: text("policy_type", { enum: POLICY_TYPES }).notNull(),
		policyId: text("policy_id").notNull(),
		triggerType: text("trigger_type", { enum: SLA_TRIGGER_TYPES }).notNull(),
		targetType: text("target_type", {
			enum: SLA_NOTIFICATION_TARGET_TYPES,
		}).notNull(),
		// Percentage of the target at which warning rules fire; breach rules use 100.
		thresholdPercent: integer("threshold_percent").notNull().default(100),
		recipientType: text("recipient_type", {
			enum: SLA_RECIPIENT_TYPES,
		}).notNull(),
		// Team id or explicit address; null means the current ticket assignee.
		recipient: text("recipient"),
		enabled: boolean("enabled").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("sla_notification_rules_policy_idx").on(t.policyType, t.policyId),
		check(
			"sla_notification_rules_threshold_range",
			sql`${t.thresholdPercent} > 0 AND ${t.thresholdPercent} <= 100`,
		),
		check(
			"sla_notification_rules_recipient_shape",
			sql`(${t.recipientType} = 'assignee' AND ${t.recipient} IS NULL) OR (${t.recipientType} <> 'assignee' AND ${t.recipient} IS NOT NULL)`,
		),
	],
);

/** Durable sweep output. idempotencyKey makes warning/breach delivery restart-safe. */
export const slaEscalationEvents = pgTable(
	"sla_escalation_events",
	{
		id: text("id").primaryKey(),
		idempotencyKey: text("idempotency_key").notNull(),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		stopwatchId: text("stopwatch_id")
			.notNull()
			.references(() => ticketStopwatches.id, { onDelete: "cascade" }),
		ruleId: text("rule_id").references(() => slaNotificationRules.id, {
			onDelete: "set null",
		}),
		triggerType: text("trigger_type", { enum: SLA_TRIGGER_TYPES }).notNull(),
		targetType: text("target_type", { enum: SLA_TARGET_TYPES }).notNull(),
		reason: text("reason").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("sla_escalation_events_idempotency_uidx").on(t.idempotencyKey),
		index("sla_escalation_events_ticket_idx").on(t.ticketId, t.createdAt),
	],
);
