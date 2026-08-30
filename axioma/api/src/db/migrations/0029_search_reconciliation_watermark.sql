CREATE TABLE IF NOT EXISTS "search_reconciliation_state" (
  "key" text PRIMARY KEY NOT NULL,
  "last_reconciled_at" timestamp NOT NULL
);
