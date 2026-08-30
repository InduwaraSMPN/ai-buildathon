ALTER TABLE "agent_runs" ADD COLUMN "worker_id" text;
ALTER TABLE "agent_runs" ADD COLUMN "accepted_at" timestamp;
ALTER TABLE "agent_runs" ADD COLUMN "lease_expires_at" timestamp;
CREATE INDEX "agent_runs_expired_lease_idx" ON "agent_runs" ("lease_expires_at") WHERE "status" = 'running';

CREATE TABLE "agent_tool_calls" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL REFERENCES "agent_runs"("id") ON DELETE CASCADE,
  "call_id" text NOT NULL,
  "status" text DEFAULT 'in_progress' NOT NULL,
  "result" jsonb,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "finished_at" timestamp
);
CREATE UNIQUE INDEX "agent_tool_calls_run_call_uidx" ON "agent_tool_calls" ("run_id", "call_id");

ALTER TABLE "webhook_deliveries" ADD COLUMN "claimed_at" timestamp;
CREATE INDEX "webhook_deliveries_delivering_idx" ON "webhook_deliveries" ("claimed_at") WHERE "status" = 'delivering';
ALTER TABLE "workflow_executions" ADD COLUMN "claimed_at" timestamp;
ALTER TABLE "workflow_executions" ADD COLUMN "lease_expires_at" timestamp;
CREATE INDEX "workflow_executions_expired_lease_idx" ON "workflow_executions" ("lease_expires_at") WHERE "status" = 'running';
ALTER TABLE "inbound_emails" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "inbound_emails" ADD COLUMN "last_error" text;
ALTER TABLE "changes" ADD COLUMN "verification_deadline_at" timestamp;
CREATE INDEX "changes_verification_deadline_idx" ON "changes" ("verification_deadline_at") WHERE "status" = 'in_progress';

CREATE TABLE "ticket_creation_claims" (
  "id" text PRIMARY KEY NOT NULL,
  "reporter_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "idempotency_key" text NOT NULL,
  "ticket_id" text REFERENCES "tickets"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL
);
CREATE UNIQUE INDEX "ticket_creation_claims_reporter_key_uidx" ON "ticket_creation_claims" ("reporter_id", "idempotency_key");
CREATE INDEX "ticket_creation_claims_expiry_idx" ON "ticket_creation_claims" ("expires_at");
