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
import {
	ITSM_DISPATCH_OUTCOMES,
	ITSM_MAPPABLE_FIELDS,
	ITSM_PROPOSAL_VERDICTS,
	ITSM_SYNC_MODES,
	ITSM_SYNC_STATUSES,
	ITSM_UNMAPPED_POLICIES,
	ITSM_VENDORS,
	ITSM_WRITEBACK_STATUSES,
} from "@/shared";
import { agentRuns } from "./agent";
import { ticketOrigins } from "./channels";
import { environments } from "./environments";
import { tickets } from "./tickets";

export const ITSM_AUTH_TYPES = ["oauth_client_credentials"] as const;
export const ITSM_WRITEBACK_KINDS = ["work_note"] as const;

/**
 * One connection into a customer's incumbent ITSM.
 *
 * Credentials are an OAuth client id and secret; the secret uses the existing
 * AES-256-GCM scheme (`v1:iv:ciphertext:tag`) and is never returned by any API
 * surface. `defaultEnvironmentId` is where a synced ticket resolves when no
 * route matches — point it at a shadow-mode environment so the failure mode of
 * an unmapped record is too little access rather than too much.
 */
export const itsmConnectors = pgTable(
	"itsm_connectors",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		vendor: text("vendor", { enum: ITSM_VENDORS }).notNull(),
		label: text("label").notNull(),
		baseUrl: text("base_url").notNull(),
		authType: text("auth_type", { enum: ITSM_AUTH_TYPES })
			.notNull()
			.default("oauth_client_credentials"),
		clientId: text("client_id").notNull(),
		clientSecretEncrypted: text("client_secret_encrypted").notNull(),
		/** Vendor-native filter narrowing which records this connector owns. */
		recordFilter: text("record_filter").notNull().default(""),
		ticketOrigin: text("ticket_origin")
			.notNull()
			.references(() => ticketOrigins.key, { onDelete: "restrict" }),
		defaultEnvironmentId: text("default_environment_id")
			.notNull()
			.references(() => environments.id, { onDelete: "restrict" }),
		/** Reporter used when a foreign requester cannot be matched by email. */
		fallbackReporterId: text("fallback_reporter_id").notNull(),
		enabled: boolean("enabled").notNull().default(true),
		/** Set when the connector disables itself after sustained failure. */
		disabledReason: text("disabled_reason"),
		pollIntervalSeconds: integer("poll_interval_seconds")
			.notNull()
			.default(120),
		createCeiling: integer("create_ceiling").notNull().default(50),
		dispatchCeiling: integer("dispatch_ceiling").notNull().default(3),
		consecutiveFailures: integer("consecutive_failures").notNull().default(0),
		/** Highest foreign `updated_at` consumed, as reported by the vendor. */
		watermark: timestamp("watermark"),
		cursor: text("cursor"),
		lastSuccessfulSyncAt: timestamp("last_successful_sync_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("itsm_connectors_key_uidx").on(t.key),
		index("itsm_connectors_enabled_idx").on(t.enabled),
		check(
			"itsm_connectors_poll_interval_positive",
			sql`${t.pollIntervalSeconds} > 0`,
		),
		check(
			"itsm_connectors_create_ceiling_positive",
			sql`${t.createCeiling} > 0`,
		),
		check(
			"itsm_connectors_dispatch_ceiling_positive",
			sql`${t.dispatchCeiling} > 0`,
		),
	],
);

/**
 * One row per sync pass, including the refused and failed ones.
 *
 * `directory_sync_runs` declares `rejected` and `failed` and never writes
 * either, because its safety brake throws before the row is inserted. That gap
 * is deliberately not copied: a refused sync is exactly the pass an
 * administrator needs to see.
 */
export const itsmConnectorRuns = pgTable(
	"itsm_connector_runs",
	{
		id: text("id").primaryKey(),
		connectorId: text("connector_id")
			.notNull()
			.references(() => itsmConnectors.id, { onDelete: "cascade" }),
		mode: text("mode", { enum: ITSM_SYNC_MODES }).notNull(),
		status: text("status", { enum: ITSM_SYNC_STATUSES }).notNull(),
		fetchedCount: integer("fetched_count").notNull().default(0),
		createdCount: integer("created_count").notNull().default(0),
		updatedCount: integer("updated_count").notNull().default(0),
		skippedCount: integer("skipped_count").notNull().default(0),
		dispatchedCount: integer("dispatched_count").notNull().default(0),
		quarantinedCount: integer("quarantined_count").notNull().default(0),
		error: text("error"),
		summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("itsm_connector_runs_connector_idx").on(t.connectorId, t.createdAt),
	],
);

/**
 * Ticket provenance, kept beside `tickets` rather than on it — the same shape
 * and the same reason as `ticket_mail_origins`. One row per ticket.
 */
export const itsmTicketOrigins = pgTable(
	"itsm_ticket_origins",
	{
		ticketId: text("ticket_id")
			.primaryKey()
			.references(() => tickets.id, { onDelete: "cascade" }),
		connectorId: text("connector_id")
			.notNull()
			.references(() => itsmConnectors.id, { onDelete: "restrict" }),
		/** The foreign system's own identifier — ServiceNow's `sys_id`. */
		externalId: text("external_id").notNull(),
		/** The human-facing reference, e.g. `INC0010023`. */
		externalKey: text("external_key").notNull(),
		externalUrl: text("external_url"),
		foreignUpdatedAt: timestamp("foreign_updated_at").notNull(),
		/** Foreign timestamp produced by our own last write-back; echo suppression. */
		lastWrittenAt: timestamp("last_written_at"),
		dispatchCount: integer("dispatch_count").notNull().default(0),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("itsm_ticket_origins_external_uidx").on(
			t.connectorId,
			t.externalId,
		),
		index("itsm_ticket_origins_connector_idx").on(t.connectorId),
		check(
			"itsm_ticket_origins_dispatch_count_nonnegative",
			sql`${t.dispatchCount} >= 0`,
		),
	],
);

/**
 * The inbox pattern with a domain key.
 *
 * `triggerKey` names the *transition* that justified a dispatch, not the
 * revision that carried it, so re-observing one change yields one key and the
 * unique constraint refuses the second attempt. This is the layer that makes
 * dispatch idempotent rather than merely deduplicated.
 */
export const itsmDispatchLedger = pgTable(
	"itsm_dispatch_ledger",
	{
		id: text("id").primaryKey(),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		connectorId: text("connector_id")
			.notNull()
			.references(() => itsmConnectors.id, { onDelete: "cascade" }),
		triggerKey: text("trigger_key").notNull(),
		outcome: text("outcome", { enum: ITSM_DISPATCH_OUTCOMES }).notNull(),
		detail: text("detail"),
		runId: text("run_id").references(() => agentRuns.id, {
			onDelete: "set null",
		}),
		dispatchedAt: timestamp("dispatched_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("itsm_dispatch_ledger_trigger_uidx").on(
			t.ticketId,
			t.triggerKey,
		),
		index("itsm_dispatch_ledger_connector_idx").on(
			t.connectorId,
			t.dispatchedAt,
		),
	],
);

/**
 * Administrator-maintained allowlist from a foreign field value to an
 * environment. Ordered; first match wins; unmatched falls through to the
 * connector default.
 *
 * This is an allowlist rather than a trust decision. A foreign value cannot
 * name an environment nobody entered, so the blast radius of a mis-ACL'd or
 * filer-writable foreign field is bounded by the set an administrator chose.
 */
export const itsmEnvironmentRoutes = pgTable(
	"itsm_environment_routes",
	{
		id: text("id").primaryKey(),
		connectorId: text("connector_id")
			.notNull()
			.references(() => itsmConnectors.id, { onDelete: "cascade" }),
		sourceField: text("source_field").notNull(),
		sourceValue: text("source_value").notNull(),
		environmentId: text("environment_id")
			.notNull()
			.references(() => environments.id, { onDelete: "restrict" }),
		position: integer("position").notNull().default(0),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("itsm_environment_routes_match_uidx").on(
			t.connectorId,
			t.sourceField,
			t.sourceValue,
		),
		index("itsm_environment_routes_order_idx").on(t.connectorId, t.position),
	],
);

/** Declarative field and value mapping. Configuration, not code. */
export const itsmFieldMappings = pgTable(
	"itsm_field_mappings",
	{
		id: text("id").primaryKey(),
		connectorId: text("connector_id")
			.notNull()
			.references(() => itsmConnectors.id, { onDelete: "cascade" }),
		sourceField: text("source_field").notNull(),
		targetField: text("target_field", { enum: ITSM_MAPPABLE_FIELDS }).notNull(),
		valueMap: jsonb("value_map").$type<Record<string, string>>().notNull(),
		onUnmapped: text("on_unmapped", { enum: ITSM_UNMAPPED_POLICIES })
			.notNull()
			.default("quarantine"),
		defaultValue: text("default_value"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("itsm_field_mappings_target_uidx").on(
			t.connectorId,
			t.targetField,
		),
	],
);

/**
 * Durable outbound work notes.
 *
 * Copied structurally from `webhook_deliveries` rather than from
 * `email_send_log`: the send log records one row per attempt and never
 * retries, and a work note that silently fails to post is worse than one that
 * never existed.
 */
export const itsmWritebacks = pgTable(
	"itsm_writebacks",
	{
		id: text("id").primaryKey(),
		connectorId: text("connector_id")
			.notNull()
			.references(() => itsmConnectors.id, { onDelete: "cascade" }),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		runId: text("run_id").references(() => agentRuns.id, {
			onDelete: "set null",
		}),
		kind: text("kind", { enum: ITSM_WRITEBACK_KINDS })
			.notNull()
			.default("work_note"),
		payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
		status: text("status", { enum: ITSM_WRITEBACK_STATUSES })
			.notNull()
			.default("pending"),
		attemptCount: integer("attempt_count").notNull().default(0),
		maxAttempts: integer("max_attempts").notNull().default(5),
		nextAttemptAt: timestamp("next_attempt_at"),
		claimedAt: timestamp("claimed_at"),
		responseStatus: integer("response_status"),
		lastError: text("last_error"),
		/** Identifier the foreign system returned for the posted note. */
		externalReceiptId: text("external_receipt_id"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		completedAt: timestamp("completed_at"),
	},
	(t) => [
		index("itsm_writebacks_due_idx").on(t.status, t.nextAttemptAt),
		index("itsm_writebacks_ticket_idx").on(t.ticketId),
		check("itsm_writebacks_attempt_nonnegative", sql`${t.attemptCount} >= 0`),
		check("itsm_writebacks_max_attempts_positive", sql`${t.maxAttempts} > 0`),
		check(
			"itsm_writebacks_attempt_within_max",
			sql`${t.attemptCount} <= ${t.maxAttempts}`,
		),
	],
);

/**
 * The shadow-mode proposal artefact.
 *
 * `openedAt` is recorded separately from any verdict because agreement
 * statistics are worthless if nobody read the proposal, and the base rates say
 * that is the likely case. An honest report separates "opened" from "agreed".
 */
export const itsmProposals = pgTable(
	"itsm_proposals",
	{
		id: text("id").primaryKey(),
		runId: text("run_id")
			.notNull()
			.references(() => agentRuns.id, { onDelete: "cascade" }),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		connectorId: text("connector_id")
			.notNull()
			.references(() => itsmConnectors.id, { onDelete: "cascade" }),
		/** The write-effect calls the shadow guard refused, in order. */
		suppressedCalls: jsonb("suppressed_calls")
			.$type<readonly Record<string, unknown>[]>()
			.notNull(),
		postedAt: timestamp("posted_at"),
		openedAt: timestamp("opened_at"),
		/** Filled by a later sync pass, once the foreign ticket closes. */
		foreignResolution: text("foreign_resolution"),
		foreignClosedBy: text("foreign_closed_by"),
		observedAt: timestamp("observed_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("itsm_proposals_run_uidx").on(t.runId),
		index("itsm_proposals_connector_idx").on(t.connectorId, t.createdAt),
	],
);

/**
 * One verdict per suppressed call rather than per proposal.
 *
 * The unit of judgement is the suggestion, not the review — a reviewer who
 * accepts the diagnosis and rejects one step of the fix should be able to say
 * so. A single verdict per proposal would lose that and flatter the agreement
 * statistics in both directions.
 */
export const itsmProposalVerdicts = pgTable(
	"itsm_proposal_verdicts",
	{
		id: text("id").primaryKey(),
		proposalId: text("proposal_id")
			.notNull()
			.references(() => itsmProposals.id, { onDelete: "cascade" }),
		callOrdinal: integer("call_ordinal").notNull(),
		verdict: text("verdict", { enum: ITSM_PROPOSAL_VERDICTS }).notNull(),
		reviewerId: text("reviewer_id").notNull(),
		note: text("note"),
		decidedAt: timestamp("decided_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("itsm_proposal_verdicts_call_uidx").on(
			t.proposalId,
			t.callOrdinal,
			t.reviewerId,
		),
		index("itsm_proposal_verdicts_reviewer_idx").on(t.reviewerId, t.decidedAt),
	],
);
