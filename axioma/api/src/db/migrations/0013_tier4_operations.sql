BEGIN;

-- Tier 4 mail and templates.
CREATE TABLE IF NOT EXISTS "mailboxes" (
  "id" text PRIMARY KEY, "address" text NOT NULL UNIQUE, "name" text NOT NULL,
  "ticket_origin" text NOT NULL, "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "inbound_emails" (
  "id" text PRIMARY KEY, "mailbox_id" text NOT NULL REFERENCES "mailboxes"("id") ON DELETE restrict,
  "provider_message_id" text NOT NULL, "from_address" text NOT NULL, "to_address" text NOT NULL,
  "subject" text NOT NULL, "text_body" text, "html_body" text, "headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'received' NOT NULL, "ticket_id" text REFERENCES "tickets"("id") ON DELETE set null,
  "received_at" timestamp NOT NULL, "processed_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "inbound_emails_mailbox_provider_uidx" ON "inbound_emails" ("mailbox_id", "provider_message_id");
CREATE INDEX IF NOT EXISTS "inbound_emails_ticket_idx" ON "inbound_emails" ("ticket_id", "received_at");
CREATE TABLE IF NOT EXISTS "email_attachments" (
  "id" text PRIMARY KEY, "inbound_email_id" text NOT NULL REFERENCES "inbound_emails"("id") ON DELETE cascade,
  "filename" text NOT NULL, "content_type" text NOT NULL, "storage_key" text NOT NULL,
  "content_id" text, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "email_attachments_inbound_idx" ON "email_attachments" ("inbound_email_id");
CREATE TABLE IF NOT EXISTS "mailbox_activity_log" (
  "id" text PRIMARY KEY, "mailbox_id" text NOT NULL REFERENCES "mailboxes"("id") ON DELETE cascade,
  "inbound_email_id" text REFERENCES "inbound_emails"("id") ON DELETE set null,
  "decision" text NOT NULL, "reason" text NOT NULL, "ticket_id" text REFERENCES "tickets"("id") ON DELETE set null,
  "details" jsonb, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "mailbox_activity_mailbox_idx" ON "mailbox_activity_log" ("mailbox_id", "created_at");
CREATE TABLE IF NOT EXISTS "ticket_mail_origins" (
  "ticket_id" text PRIMARY KEY REFERENCES "tickets"("id") ON DELETE cascade,
  "mailbox_id" text NOT NULL REFERENCES "mailboxes"("id") ON DELETE restrict,
  "ticket_origin" text NOT NULL, "inbound_email_id" text NOT NULL REFERENCES "inbound_emails"("id") ON DELETE restrict,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ticket_mail_origins_mailbox_idx" ON "ticket_mail_origins" ("mailbox_id");
CREATE TABLE IF NOT EXISTS "email_send_log" (
  "id" text PRIMARY KEY, "recipient" text NOT NULL, "subsystem" text NOT NULL,
  "ticket_id" text REFERENCES "tickets"("id") ON DELETE set null, "template_id" text,
  "subject" text NOT NULL, "outcome" text NOT NULL, "provider_message_id" text,
  "provider_text" text NOT NULL, "attempted_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "email_send_log_ticket_idx" ON "email_send_log" ("ticket_id", "attempted_at");
CREATE INDEX IF NOT EXISTS "email_send_log_recipient_idx" ON "email_send_log" ("recipient", "attempted_at");

CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" text PRIMARY KEY, "name" text NOT NULL, "subject" text NOT NULL, "text_body" text NOT NULL,
  "html_body" text, "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "email_template_rules" (
  "id" text PRIMARY KEY, "template_id" text NOT NULL REFERENCES "email_templates"("id") ON DELETE cascade,
  "scope" text NOT NULL, "match_value" text, "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "email_template_rules_match_shape" CHECK (("scope" = 'catch_all' AND "match_value" IS NULL) OR ("scope" <> 'catch_all' AND "match_value" IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS "email_template_rules_lookup_idx" ON "email_template_rules" ("enabled", "scope", "match_value");

-- asset_types, asset_locations, asset_statuses, assets and all inventory.ts tables
-- already exist in 0010_inventory.sql. Add only the remaining assets.ts tables.
CREATE TABLE IF NOT EXISTS "asset_checkout_log" (
  "id" text PRIMARY KEY, "asset_id" text NOT NULL REFERENCES "assets"("id") ON DELETE cascade,
  "custodian_id" text REFERENCES "user"("id") ON DELETE set null,
  "checked_out_at" timestamp NOT NULL, "checked_in_at" timestamp, "note" text
);
CREATE INDEX IF NOT EXISTS "asset_checkout_asset_idx" ON "asset_checkout_log" ("asset_id", "checked_out_at");
CREATE TABLE IF NOT EXISTS "asset_history" (
  "id" text PRIMARY KEY, "asset_id" text NOT NULL REFERENCES "assets"("id") ON DELETE cascade,
  "action" text NOT NULL, "actor_id" text REFERENCES "user"("id") ON DELETE set null,
  "changes" jsonb NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "asset_history_asset_idx" ON "asset_history" ("asset_id", "created_at");
CREATE TABLE IF NOT EXISTS "asset_import_profiles" (
  "id" text PRIMARY KEY, "name" text NOT NULL, "identity_columns" text[] NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "asset_import_profiles_name_uidx" ON "asset_import_profiles" ("name");
CREATE TABLE IF NOT EXISTS "asset_import_runs" (
  "id" text PRIMARY KEY, "profile_id" text REFERENCES "asset_import_profiles"("id") ON DELETE set null,
  "file_name" text, "total_rows" integer NOT NULL, "accepted_rows" integer NOT NULL,
  "rejected_rows" integer NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "asset_import_runs_profile_idx" ON "asset_import_runs" ("profile_id", "created_at");
CREATE TABLE IF NOT EXISTS "asset_import_identities" (
  "id" text PRIMARY KEY, "profile_id" text NOT NULL REFERENCES "asset_import_profiles"("id") ON DELETE cascade,
  "identity_key" text NOT NULL, "asset_id" text NOT NULL REFERENCES "assets"("id") ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "asset_import_identity_uidx" ON "asset_import_identities" ("profile_id", "identity_key");
CREATE INDEX IF NOT EXISTS "asset_import_identity_asset_idx" ON "asset_import_identities" ("asset_id");
CREATE TABLE IF NOT EXISTS "asset_import_rejections" (
  "id" text PRIMARY KEY, "run_id" text NOT NULL REFERENCES "asset_import_runs"("id") ON DELETE cascade,
  "row_number" integer NOT NULL, "reason" text NOT NULL, "row" jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS "asset_import_rejections_run_idx" ON "asset_import_rejections" ("run_id", "row_number");

-- Public status and documents.
CREATE TABLE IF NOT EXISTS "service_impact_levels" (
  "key" text PRIMARY KEY, "label" text NOT NULL, "counts_as_downtime" boolean DEFAULT true NOT NULL
);
CREATE TABLE IF NOT EXISTS "status_services" (
  "id" text PRIMARY KEY, "name" text NOT NULL, "description" text,
  "active" boolean DEFAULT true NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "status_incidents" (
  "id" text PRIMARY KEY, "service_id" text NOT NULL REFERENCES "status_services"("id") ON DELETE cascade,
  "impact_level" text NOT NULL REFERENCES "service_impact_levels"("key"), "title" text NOT NULL,
  "planned_maintenance" boolean DEFAULT false NOT NULL, "started_at" timestamp NOT NULL,
  "resolved_at" timestamp, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "status_incidents_service_time_idx" ON "status_incidents" ("service_id", "started_at");
CREATE TABLE IF NOT EXISTS "status_incident_updates" (
  "id" text PRIMARY KEY, "incident_id" text NOT NULL REFERENCES "status_incidents"("id") ON DELETE cascade,
  "state" text NOT NULL, "message" text NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "status_incident_updates_incident_idx" ON "status_incident_updates" ("incident_id", "created_at");

CREATE TABLE IF NOT EXISTS "documents" (
  "id" text PRIMARY KEY, "kind" text NOT NULL, "display_name" text NOT NULL, "media_type" text,
  "sha256" text, "stored_filename" text, "url" text, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "documents_sha256_uidx" ON "documents" ("sha256");
CREATE UNIQUE INDEX IF NOT EXISTS "documents_stored_filename_uidx" ON "documents" ("stored_filename");
CREATE TABLE IF NOT EXISTS "document_links" (
  "id" text PRIMARY KEY, "document_id" text NOT NULL REFERENCES "documents"("id") ON DELETE cascade,
  "target_type" text NOT NULL, "target_id" text NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "document_links_target_uidx" ON "document_links" ("document_id", "target_type", "target_id");
CREATE INDEX IF NOT EXISTS "document_links_target_idx" ON "document_links" ("target_type", "target_id");

-- Scheduling.
CREATE TABLE IF NOT EXISTS "ticket_scheduling" (
  "ticket_id" text PRIMARY KEY REFERENCES "tickets"("id") ON DELETE cascade,
  "work_start_at" timestamp, "work_end_at" timestamp, "work_all_day" boolean DEFAULT false NOT NULL,
  "snoozed_until" timestamp, "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ticket_scheduling_work_range_check" CHECK (("work_start_at" IS NULL AND "work_end_at" IS NULL) OR ("work_start_at" IS NOT NULL AND "work_end_at" IS NOT NULL AND "work_end_at" >= "work_start_at"))
);
CREATE INDEX IF NOT EXISTS "ticket_scheduling_calendar_idx" ON "ticket_scheduling" ("work_start_at", "work_end_at");
CREATE INDEX IF NOT EXISTS "ticket_scheduling_snooze_idx" ON "ticket_scheduling" ("snoozed_until");
CREATE TABLE IF NOT EXISTS "recurring_tickets" (
  "id" text PRIMARY KEY, "source_ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,
  "frequency" text NOT NULL, "interval" integer DEFAULT 1 NOT NULL, "starts_at" timestamp NOT NULL,
  "until" timestamp, "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "recurring_tickets_interval_positive" CHECK ("interval" > 0),
  CONSTRAINT "recurring_tickets_until_check" CHECK ("until" IS NULL OR "until" >= "starts_at")
);
CREATE INDEX IF NOT EXISTS "recurring_tickets_due_idx" ON "recurring_tickets" ("enabled", "starts_at");
CREATE TABLE IF NOT EXISTS "recurring_ticket_occurrences" (
  "id" text PRIMARY KEY, "recurring_ticket_id" text NOT NULL REFERENCES "recurring_tickets"("id") ON DELETE cascade,
  "occurs_at" timestamp NOT NULL, "idempotency_key" text NOT NULL,
  "generated_ticket_id" text REFERENCES "tickets"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_ticket_occurrences_slot_uidx" ON "recurring_ticket_occurrences" ("recurring_ticket_id", "occurs_at");
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_ticket_occurrences_key_uidx" ON "recurring_ticket_occurrences" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "recurring_ticket_occurrences_ticket_idx" ON "recurring_ticket_occurrences" ("generated_ticket_id");

-- Suppliers and contracts. contracts.service_id is intentionally scalar, matching suppliers.ts.
CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" text PRIMARY KEY, "name" text NOT NULL, "contact_name" text, "contact_email" text,
  "active" boolean DEFAULT true NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "contracts" (
  "id" text PRIMARY KEY, "supplier_id" text NOT NULL REFERENCES "suppliers"("id") ON DELETE restrict,
  "service_id" text NOT NULL, "name" text NOT NULL, "reference" text, "starts_on" date NOT NULL,
  "ends_on" date, "active" boolean DEFAULT true NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "contracts_date_range_check" CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on")
);
CREATE INDEX IF NOT EXISTS "contracts_service_dates_idx" ON "contracts" ("service_id", "starts_on", "ends_on");
CREATE INDEX IF NOT EXISTS "contracts_supplier_idx" ON "contracts" ("supplier_id");
CREATE TABLE IF NOT EXISTS "contract_coverage_windows" (
  "id" text PRIMARY KEY, "contract_id" text NOT NULL REFERENCES "contracts"("id") ON DELETE cascade,
  "sla_id" text NOT NULL REFERENCES "slas"("id") ON DELETE restrict, "timezone" text NOT NULL,
  "weekday" integer NOT NULL, "start_minute" integer NOT NULL, "end_minute" integer NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "contract_coverage_windows_weekday_check" CHECK ("weekday" between 0 and 6),
  CONSTRAINT "contract_coverage_windows_minutes_check" CHECK ("start_minute" >= 0 AND "start_minute" < "end_minute" AND "end_minute" <= 1440)
);
CREATE INDEX IF NOT EXISTS "contract_coverage_windows_contract_idx" ON "contract_coverage_windows" ("contract_id", "weekday");
CREATE TABLE IF NOT EXISTS "contract_terms" (
  "id" text PRIMARY KEY, "contract_id" text NOT NULL REFERENCES "contracts"("id") ON DELETE cascade,
  "name" text NOT NULL, "value" jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS "contract_terms_contract_idx" ON "contract_terms" ("contract_id");
CREATE TABLE IF NOT EXISTS "payment_schedules" (
  "id" text PRIMARY KEY, "contract_id" text NOT NULL REFERENCES "contracts"("id") ON DELETE cascade,
  "due_on" date NOT NULL, "amount" numeric(14,2) NOT NULL, "currency" text NOT NULL, "paid_at" timestamp,
  CONSTRAINT "payment_schedules_amount_nonnegative" CHECK ("amount" >= 0)
);
CREATE INDEX IF NOT EXISTS "payment_schedules_contract_due_idx" ON "payment_schedules" ("contract_id", "due_on");

-- Personal dashboards.
CREATE TABLE IF NOT EXISTS "dashboard_widgets" (
  "id" text PRIMARY KEY, "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "widget_key" text NOT NULL, "position" integer NOT NULL, "width" integer DEFAULT 1 NOT NULL,
  "settings" jsonb, "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "dashboard_widgets_position_nonnegative" CHECK ("position" >= 0),
  CONSTRAINT "dashboard_widgets_width_check" CHECK ("width" between 1 and 2)
);
CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_widgets_user_key_uidx" ON "dashboard_widgets" ("user_id", "widget_key");
CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_widgets_user_position_uidx" ON "dashboard_widgets" ("user_id", "position");
CREATE INDEX IF NOT EXISTS "dashboard_widgets_user_idx" ON "dashboard_widgets" ("user_id", "position");

-- Identity providers and directory sync.
CREATE TABLE IF NOT EXISTS "auth_providers" (
  "id" text PRIMARY KEY, "provider_id" text NOT NULL, "name" text NOT NULL, "discovery_url" text NOT NULL,
  "client_id" text NOT NULL, "client_secret_encrypted" text NOT NULL,
  "scopes" text[] DEFAULT ARRAY['openid','profile','email']::text[] NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "auth_providers_provider_id_check" CHECK ("provider_id" ~ '^[a-z0-9][a-z0-9_-]*$')
);
CREATE UNIQUE INDEX IF NOT EXISTS "auth_providers_provider_id_uidx" ON "auth_providers" ("provider_id");
CREATE TABLE IF NOT EXISTS "sso_identities" (
  "id" text PRIMARY KEY, "provider_id" text NOT NULL REFERENCES "auth_providers"("id") ON DELETE restrict,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade, "issuer" text NOT NULL,
  "subject" text NOT NULL, "email" text NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL,
  "last_signed_in_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "sso_identities_issuer_subject_uidx" ON "sso_identities" ("issuer", "subject");
CREATE INDEX IF NOT EXISTS "sso_identities_user_idx" ON "sso_identities" ("user_id");
CREATE TABLE IF NOT EXISTS "directory_identities" (
  "id" text PRIMARY KEY, "provider_id" text NOT NULL REFERENCES "auth_providers"("id") ON DELETE restrict,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict, "external_id" text NOT NULL,
  "department" text, "leaver" boolean DEFAULT false NOT NULL, "last_seen_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "directory_identities_provider_external_uidx" ON "directory_identities" ("provider_id", "external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "directory_identities_provider_user_uidx" ON "directory_identities" ("provider_id", "user_id");
CREATE INDEX IF NOT EXISTS "directory_identities_leaver_idx" ON "directory_identities" ("provider_id", "leaver");
CREATE TABLE IF NOT EXISTS "directory_sync_runs" (
  "id" text PRIMARY KEY, "provider_id" text NOT NULL REFERENCES "auth_providers"("id") ON DELETE restrict,
  "mode" text NOT NULL, "status" text NOT NULL, "previous_count" integer NOT NULL,
  "found_count" integer NOT NULL, "created_count" integer NOT NULL, "updated_count" integer NOT NULL,
  "leaver_count" integer NOT NULL, "summary" jsonb NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "directory_sync_runs_provider_created_idx" ON "directory_sync_runs" ("provider_id", "created_at");

-- Messaging channels.
CREATE TABLE IF NOT EXISTS "ticket_origins" (
  "id" text PRIMARY KEY, "key" text NOT NULL, "name" text NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_origins_key_uidx" ON "ticket_origins" ("key");
CREATE TABLE IF NOT EXISTS "messaging_channels" (
  "id" text PRIMARY KEY, "key" text NOT NULL, "name" text NOT NULL, "kind" text NOT NULL,
  "default_origin_id" text REFERENCES "ticket_origins"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "messaging_channels_key_uidx" ON "messaging_channels" ("key");
CREATE TABLE IF NOT EXISTS "messaging_threads" (
  "id" text PRIMARY KEY, "channel_id" text NOT NULL REFERENCES "messaging_channels"("id") ON DELETE cascade,
  "external_thread_id" text NOT NULL, "ticket_id" text REFERENCES "tickets"("id") ON DELETE set null,
  "origin_key" text NOT NULL, "participant_ref" text, "opened_at" timestamp NOT NULL,
  "last_message_at" timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "messaging_threads_external_uidx" ON "messaging_threads" ("channel_id", "external_thread_id");
CREATE INDEX IF NOT EXISTS "messaging_threads_ticket_idx" ON "messaging_threads" ("ticket_id", "last_message_at");
CREATE TABLE IF NOT EXISTS "channel_messages" (
  "id" text PRIMARY KEY, "thread_id" text NOT NULL REFERENCES "messaging_threads"("id") ON DELETE cascade,
  "external_message_id" text NOT NULL, "direction" text NOT NULL, "sender_ref" text,
  "body" text NOT NULL, "raw" jsonb, "received_at" timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "channel_messages_external_uidx" ON "channel_messages" ("thread_id", "external_message_id");
CREATE INDEX IF NOT EXISTS "channel_messages_thread_idx" ON "channel_messages" ("thread_id", "received_at");

-- Software licences.
CREATE TABLE IF NOT EXISTS "software_products" (
  "id" text PRIMARY KEY, "name" text NOT NULL, "publisher" text, "identity_key" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "software_products_identity_uidx" ON "software_products" ("identity_key");
CREATE TABLE IF NOT EXISTS "software_licence_entitlements" (
  "id" text PRIMARY KEY, "product_id" text NOT NULL REFERENCES "software_products"("id") ON DELETE cascade,
  "licence_key" text, "seat_count" integer NOT NULL, "valid_from" timestamp, "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "software_entitlements_seats_positive" CHECK ("seat_count" > 0),
  CONSTRAINT "software_entitlements_dates_valid" CHECK ("valid_from" is null OR "expires_at" is null OR "expires_at" >= "valid_from")
);
CREATE INDEX IF NOT EXISTS "software_entitlements_product_idx" ON "software_licence_entitlements" ("product_id", "expires_at");
CREATE TABLE IF NOT EXISTS "software_licence_allocations" (
  "id" text PRIMARY KEY, "entitlement_id" text NOT NULL REFERENCES "software_licence_entitlements"("id") ON DELETE cascade,
  "asset_id" text REFERENCES "assets"("id") ON DELETE cascade,
  "user_id" text REFERENCES "user"("id") ON DELETE cascade,
  "allocated_at" timestamp DEFAULT now() NOT NULL, "revoked_at" timestamp,
  CONSTRAINT "software_allocations_one_target" CHECK ((("asset_id" is not null)::int + ("user_id" is not null)::int) = 1)
);
CREATE INDEX IF NOT EXISTS "software_allocations_entitlement_idx" ON "software_licence_allocations" ("entitlement_id", "revoked_at");
CREATE INDEX IF NOT EXISTS "software_allocations_asset_idx" ON "software_licence_allocations" ("asset_id");
CREATE INDEX IF NOT EXISTS "software_allocations_user_idx" ON "software_licence_allocations" ("user_id");

COMMIT;
