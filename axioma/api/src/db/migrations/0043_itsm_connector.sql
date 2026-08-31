-- Phase 6 — ITSM connector.
-- Nine tables, none of which touches "tickets": ticket provenance lives beside
-- the ticket, the way "ticket_mail_origins" does and for the same reason.

INSERT INTO "ticket_origins" ("id", "key", "name") VALUES
 ('origin-itsm', 'itsm', 'ITSM connector') ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "itsm_connectors" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"vendor" text NOT NULL,
	"label" text NOT NULL,
	"base_url" text NOT NULL,
	"auth_type" text DEFAULT 'oauth_client_credentials' NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_encrypted" text NOT NULL,
	"record_filter" text DEFAULT '' NOT NULL,
	"ticket_origin" text NOT NULL,
	"default_environment_id" text NOT NULL,
	"fallback_reporter_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"disabled_reason" text,
	"poll_interval_seconds" integer DEFAULT 120 NOT NULL,
	"create_ceiling" integer DEFAULT 50 NOT NULL,
	"dispatch_ceiling" integer DEFAULT 3 NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"watermark" timestamp,
	"cursor" text,
	"last_successful_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "itsm_connectors_poll_interval_positive" CHECK ("itsm_connectors"."poll_interval_seconds" > 0),
	CONSTRAINT "itsm_connectors_create_ceiling_positive" CHECK ("itsm_connectors"."create_ceiling" > 0),
	CONSTRAINT "itsm_connectors_dispatch_ceiling_positive" CHECK ("itsm_connectors"."dispatch_ceiling" > 0)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "itsm_connector_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"connector_id" text NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"fetched_count" integer DEFAULT 0 NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"dispatched_count" integer DEFAULT 0 NOT NULL,
	"quarantined_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"summary" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "itsm_ticket_origins" (
	"ticket_id" text PRIMARY KEY NOT NULL,
	"connector_id" text NOT NULL,
	"external_id" text NOT NULL,
	"external_key" text NOT NULL,
	"external_url" text,
	"foreign_updated_at" timestamp NOT NULL,
	"last_written_at" timestamp,
	"dispatch_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "itsm_ticket_origins_dispatch_count_nonnegative" CHECK ("itsm_ticket_origins"."dispatch_count" >= 0)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "itsm_dispatch_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"connector_id" text NOT NULL,
	"trigger_key" text NOT NULL,
	"outcome" text NOT NULL,
	"detail" text,
	"run_id" text,
	"dispatched_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "itsm_environment_routes" (
	"id" text PRIMARY KEY NOT NULL,
	"connector_id" text NOT NULL,
	"source_field" text NOT NULL,
	"source_value" text NOT NULL,
	"environment_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "itsm_field_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"connector_id" text NOT NULL,
	"source_field" text NOT NULL,
	"target_field" text NOT NULL,
	"value_map" jsonb NOT NULL,
	"on_unmapped" text DEFAULT 'quarantine' NOT NULL,
	"default_value" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "itsm_writebacks" (
	"id" text PRIMARY KEY NOT NULL,
	"connector_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"run_id" text,
	"kind" text DEFAULT 'work_note' NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_attempt_at" timestamp,
	"claimed_at" timestamp,
	"response_status" integer,
	"last_error" text,
	"external_receipt_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "itsm_writebacks_attempt_nonnegative" CHECK ("itsm_writebacks"."attempt_count" >= 0),
	CONSTRAINT "itsm_writebacks_max_attempts_positive" CHECK ("itsm_writebacks"."max_attempts" > 0),
	CONSTRAINT "itsm_writebacks_attempt_within_max" CHECK ("itsm_writebacks"."attempt_count" <= "itsm_writebacks"."max_attempts")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "itsm_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"connector_id" text NOT NULL,
	"suppressed_calls" jsonb NOT NULL,
	"posted_at" timestamp,
	"opened_at" timestamp,
	"foreign_resolution" text,
	"foreign_closed_by" text,
	"observed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "itsm_proposal_verdicts" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"call_ordinal" integer NOT NULL,
	"verdict" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"note" text,
	"decided_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "itsm_connectors" ADD CONSTRAINT "itsm_connectors_ticket_origin_fk" FOREIGN KEY ("ticket_origin") REFERENCES "ticket_origins"("key") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "itsm_connectors" ADD CONSTRAINT "itsm_connectors_default_environment_fk" FOREIGN KEY ("default_environment_id") REFERENCES "environments"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "itsm_connector_runs" ADD CONSTRAINT "itsm_connector_runs_connector_fk" FOREIGN KEY ("connector_id") REFERENCES "itsm_connectors"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "itsm_ticket_origins" ADD CONSTRAINT "itsm_ticket_origins_ticket_fk" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "itsm_ticket_origins" ADD CONSTRAINT "itsm_ticket_origins_connector_fk" FOREIGN KEY ("connector_id") REFERENCES "itsm_connectors"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "itsm_dispatch_ledger" ADD CONSTRAINT "itsm_dispatch_ledger_ticket_fk" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "itsm_dispatch_ledger" ADD CONSTRAINT "itsm_dispatch_ledger_connector_fk" FOREIGN KEY ("connector_id") REFERENCES "itsm_connectors"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "itsm_dispatch_ledger" ADD CONSTRAINT "itsm_dispatch_ledger_run_fk" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "itsm_environment_routes" ADD CONSTRAINT "itsm_environment_routes_connector_fk" FOREIGN KEY ("connector_id") REFERENCES "itsm_connectors"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "itsm_environment_routes" ADD CONSTRAINT "itsm_environment_routes_environment_fk" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "itsm_field_mappings" ADD CONSTRAINT "itsm_field_mappings_connector_fk" FOREIGN KEY ("connector_id") REFERENCES "itsm_connectors"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "itsm_writebacks" ADD CONSTRAINT "itsm_writebacks_connector_fk" FOREIGN KEY ("connector_id") REFERENCES "itsm_connectors"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "itsm_writebacks" ADD CONSTRAINT "itsm_writebacks_ticket_fk" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "itsm_writebacks" ADD CONSTRAINT "itsm_writebacks_run_fk" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "itsm_proposals" ADD CONSTRAINT "itsm_proposals_run_fk" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "itsm_proposals" ADD CONSTRAINT "itsm_proposals_ticket_fk" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "itsm_proposals" ADD CONSTRAINT "itsm_proposals_connector_fk" FOREIGN KEY ("connector_id") REFERENCES "itsm_connectors"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "itsm_proposal_verdicts" ADD CONSTRAINT "itsm_proposal_verdicts_proposal_fk" FOREIGN KEY ("proposal_id") REFERENCES "itsm_proposals"("id") ON DELETE cascade;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "itsm_connectors_key_uidx" ON "itsm_connectors" ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "itsm_connectors_enabled_idx" ON "itsm_connectors" ("enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "itsm_connector_runs_connector_idx" ON "itsm_connector_runs" ("connector_id","created_at");--> statement-breakpoint
-- The ingestion idempotency key: the insert is the claim, as it is for
-- inbound_emails on (mailbox_id, provider_message_id).
CREATE UNIQUE INDEX IF NOT EXISTS "itsm_ticket_origins_external_uidx" ON "itsm_ticket_origins" ("connector_id","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "itsm_ticket_origins_connector_idx" ON "itsm_ticket_origins" ("connector_id");--> statement-breakpoint
-- One transition equals at most one dispatch. The key names the transition,
-- not the revision, so re-observing one change claims nothing new.
CREATE UNIQUE INDEX IF NOT EXISTS "itsm_dispatch_ledger_trigger_uidx" ON "itsm_dispatch_ledger" ("ticket_id","trigger_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "itsm_dispatch_ledger_connector_idx" ON "itsm_dispatch_ledger" ("connector_id","dispatched_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "itsm_environment_routes_match_uidx" ON "itsm_environment_routes" ("connector_id","source_field","source_value");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "itsm_environment_routes_order_idx" ON "itsm_environment_routes" ("connector_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "itsm_field_mappings_target_uidx" ON "itsm_field_mappings" ("connector_id","target_field");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "itsm_writebacks_due_idx" ON "itsm_writebacks" ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "itsm_writebacks_ticket_idx" ON "itsm_writebacks" ("ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "itsm_proposals_run_uidx" ON "itsm_proposals" ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "itsm_proposals_connector_idx" ON "itsm_proposals" ("connector_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "itsm_proposal_verdicts_call_uidx" ON "itsm_proposal_verdicts" ("proposal_id","call_ordinal","reviewer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "itsm_proposal_verdicts_reviewer_idx" ON "itsm_proposal_verdicts" ("reviewer_id","decided_at");
