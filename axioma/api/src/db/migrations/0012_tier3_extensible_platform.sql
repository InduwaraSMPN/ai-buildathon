BEGIN;

-- Tier 3 CMDB model.
CREATE TABLE IF NOT EXISTS "cmdb_classes" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "parent_class_id" text,
  CONSTRAINT "cmdb_classes_parent_class_id_cmdb_classes_id_fk" FOREIGN KEY ("parent_class_id") REFERENCES "public"."cmdb_classes"("id") ON DELETE set null
);
CREATE UNIQUE INDEX IF NOT EXISTS "cmdb_classes_key_uidx" ON "cmdb_classes" ("key");

CREATE TABLE IF NOT EXISTS "cmdb_class_properties" (
  "id" text PRIMARY KEY NOT NULL,
  "class_id" text NOT NULL,
  "property_key" text NOT NULL,
  "label" text NOT NULL,
  "property_type" text NOT NULL,
  "target_class_id" text,
  "is_required" boolean DEFAULT false NOT NULL,
  "spreads_impact" boolean DEFAULT false NOT NULL,
  CONSTRAINT "cmdb_class_properties_class_id_cmdb_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."cmdb_classes"("id") ON DELETE cascade,
  CONSTRAINT "cmdb_class_properties_target_class_id_cmdb_classes_id_fk" FOREIGN KEY ("target_class_id") REFERENCES "public"."cmdb_classes"("id") ON DELETE restrict
);
CREATE UNIQUE INDEX IF NOT EXISTS "cmdb_class_properties_key_uidx" ON "cmdb_class_properties" ("class_id", "property_key");
CREATE INDEX IF NOT EXISTS "cmdb_class_properties_target_idx" ON "cmdb_class_properties" ("target_class_id");

CREATE TABLE IF NOT EXISTS "cmdb_objects" (
  "id" text PRIMARY KEY NOT NULL,
  "class_id" text NOT NULL,
  "external_id" text NOT NULL,
  "name" text NOT NULL,
  "source_ticket_id" text,
  "source_run_id" text,
  "source_step_id" text,
  "observed_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "cmdb_objects_class_id_cmdb_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."cmdb_classes"("id") ON DELETE restrict,
  CONSTRAINT "cmdb_objects_source_ticket_id_tickets_id_fk" FOREIGN KEY ("source_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null,
  CONSTRAINT "cmdb_objects_source_run_id_agent_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null,
  CONSTRAINT "cmdb_objects_source_step_id_agent_steps_id_fk" FOREIGN KEY ("source_step_id") REFERENCES "public"."agent_steps"("id") ON DELETE set null
);
CREATE INDEX IF NOT EXISTS "cmdb_objects_lookup_idx" ON "cmdb_objects" ("class_id", "external_id", "observed_at");
CREATE INDEX IF NOT EXISTS "cmdb_objects_source_idx" ON "cmdb_objects" ("source_ticket_id");
CREATE INDEX IF NOT EXISTS "cmdb_objects_run_idx" ON "cmdb_objects" ("source_run_id");
CREATE INDEX IF NOT EXISTS "cmdb_objects_step_idx" ON "cmdb_objects" ("source_step_id");

CREATE TABLE IF NOT EXISTS "cmdb_object_properties" (
  "id" text PRIMARY KEY NOT NULL,
  "object_id" text NOT NULL,
  "property_id" text NOT NULL,
  "value" jsonb NOT NULL,
  CONSTRAINT "cmdb_object_properties_object_id_cmdb_objects_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."cmdb_objects"("id") ON DELETE cascade,
  CONSTRAINT "cmdb_object_properties_property_id_cmdb_class_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."cmdb_class_properties"("id") ON DELETE restrict
);
CREATE UNIQUE INDEX IF NOT EXISTS "cmdb_object_properties_uidx" ON "cmdb_object_properties" ("object_id", "property_id");

CREATE TABLE IF NOT EXISTS "cmdb_relationship_types" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "verb" text NOT NULL,
  "inverse_verb" text NOT NULL,
  "impact_direction" text DEFAULT 'none' NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "cmdb_relationship_types_key_uidx" ON "cmdb_relationship_types" ("key");

CREATE TABLE IF NOT EXISTS "cmdb_object_relationships" (
  "id" text PRIMARY KEY NOT NULL,
  "type_id" text NOT NULL,
  "source_object_id" text NOT NULL,
  "target_object_id" text NOT NULL,
  "property_id" text,
  CONSTRAINT "cmdb_object_relationships_type_id_cmdb_relationship_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."cmdb_relationship_types"("id") ON DELETE restrict,
  CONSTRAINT "cmdb_object_relationships_source_object_id_cmdb_objects_id_fk" FOREIGN KEY ("source_object_id") REFERENCES "public"."cmdb_objects"("id") ON DELETE cascade,
  CONSTRAINT "cmdb_object_relationships_target_object_id_cmdb_objects_id_fk" FOREIGN KEY ("target_object_id") REFERENCES "public"."cmdb_objects"("id") ON DELETE cascade,
  CONSTRAINT "cmdb_object_relationships_property_id_cmdb_class_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."cmdb_class_properties"("id") ON DELETE restrict
);
CREATE INDEX IF NOT EXISTS "cmdb_object_relationships_source_idx" ON "cmdb_object_relationships" ("source_object_id");
CREATE INDEX IF NOT EXISTS "cmdb_object_relationships_target_idx" ON "cmdb_object_relationships" ("target_object_id");

-- Stable seeds. The five legacy kinds map as follows:
-- service -> ApplicationSolution; deployment/pod -> SoftwareInstance;
-- device -> PC; dependency -> FunctionalCI.
INSERT INTO "cmdb_classes" ("id", "key", "label", "parent_class_id") VALUES
  ('cmdb-class-functional-ci', 'FunctionalCI', 'Functional CI', NULL),
  ('cmdb-class-server', 'Server', 'Server', 'cmdb-class-functional-ci'),
  ('cmdb-class-pc', 'PC', 'PC', 'cmdb-class-functional-ci'),
  ('cmdb-class-network-device', 'NetworkDevice', 'Network Device', 'cmdb-class-functional-ci'),
  ('cmdb-class-application-solution', 'ApplicationSolution', 'Application Solution', 'cmdb-class-functional-ci'),
  ('cmdb-class-business-process', 'BusinessProcess', 'Business Process', 'cmdb-class-functional-ci'),
  ('cmdb-class-software', 'Software', 'Software', 'cmdb-class-functional-ci'),
  ('cmdb-class-software-instance', 'SoftwareInstance', 'Software Instance', 'cmdb-class-functional-ci'),
  ('cmdb-class-subnet', 'Subnet', 'Subnet', 'cmdb-class-functional-ci')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "cmdb_class_properties" ("id", "class_id", "property_key", "label", "property_type") VALUES
  ('cmdb-property-functional-ci-legacy-attributes', 'cmdb-class-functional-ci', 'legacy_attributes', 'Legacy attributes', 'json'),
  ('cmdb-property-pc-legacy-attributes', 'cmdb-class-pc', 'legacy_attributes', 'Legacy attributes', 'json'),
  ('cmdb-property-application-solution-legacy-attributes', 'cmdb-class-application-solution', 'legacy_attributes', 'Legacy attributes', 'json'),
  ('cmdb-property-software-instance-legacy-attributes', 'cmdb-class-software-instance', 'legacy_attributes', 'Legacy attributes', 'json')
ON CONFLICT ("id") DO NOTHING;

-- Retain legacy ids and all four provenance columns exactly: source_ticket_id,
-- source_run_id, source_step_id, observed_at. Unknown kinds intentionally fall
-- back to FunctionalCI so every legacy row is retained.
INSERT INTO "cmdb_objects" (
  "id", "class_id", "external_id", "name",
  "source_ticket_id", "source_run_id", "source_step_id", "observed_at"
)
SELECT
  i."id",
  CASE lower(i."kind")
    WHEN 'service' THEN 'cmdb-class-application-solution'
    WHEN 'deployment' THEN 'cmdb-class-software-instance'
    WHEN 'pod' THEN 'cmdb-class-software-instance'
    WHEN 'device' THEN 'cmdb-class-pc'
    WHEN 'dependency' THEN 'cmdb-class-functional-ci'
    ELSE 'cmdb-class-functional-ci'
  END,
  i."external_id", i."name",
  i."source_ticket_id", i."source_run_id", i."source_step_id", i."observed_at"
FROM "cmdb_items" i
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "cmdb_object_properties" ("id", "object_id", "property_id", "value")
SELECT
  'legacy-attributes:' || i."id",
  i."id",
  CASE lower(i."kind")
    WHEN 'service' THEN 'cmdb-property-application-solution-legacy-attributes'
    WHEN 'deployment' THEN 'cmdb-property-software-instance-legacy-attributes'
    WHEN 'pod' THEN 'cmdb-property-software-instance-legacy-attributes'
    WHEN 'device' THEN 'cmdb-property-pc-legacy-attributes'
    ELSE 'cmdb-property-functional-ci-legacy-attributes'
  END,
  i."attributes"
FROM "cmdb_items" i
WHERE i."attributes" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

-- Preserve each legacy relation kind as a deterministic relationship type.
INSERT INTO "cmdb_relationship_types" ("id", "key", "verb", "inverse_verb", "impact_direction")
SELECT DISTINCT
  'cmdb-relationship-type:legacy:' || md5(coalesce(nullif(trim(i."relation_kind"), ''), 'relates_to')),
  'legacy:' || coalesce(nullif(trim(i."relation_kind"), ''), 'relates_to'),
  coalesce(nullif(trim(i."relation_kind"), ''), 'relates to'),
  'is related from',
  'none'
FROM "cmdb_items" i
WHERE i."relates_to_id" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "cmdb_object_relationships" ("id", "type_id", "source_object_id", "target_object_id")
SELECT
  'legacy-relation:' || i."id",
  'cmdb-relationship-type:legacy:' || md5(coalesce(nullif(trim(i."relation_kind"), ''), 'relates_to')),
  i."id",
  i."relates_to_id"
FROM "cmdb_items" i
JOIN "cmdb_objects" target ON target."id" = i."relates_to_id"
WHERE i."relates_to_id" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

-- Tier 3 links and rules.
CREATE TABLE IF NOT EXISTS "ticket_cmdb_objects" (
  "ticket_id" text NOT NULL,
  "object_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ticket_cmdb_objects_ticket_id_object_id_pk" PRIMARY KEY ("ticket_id", "object_id"),
  CONSTRAINT "ticket_cmdb_objects_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade,
  CONSTRAINT "ticket_cmdb_objects_object_id_cmdb_objects_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."cmdb_objects"("id") ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "ticket_cmdb_objects_object_idx" ON "ticket_cmdb_objects" ("object_id");

CREATE TABLE IF NOT EXISTS "ticket_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "position" integer NOT NULL,
  "criteria" jsonb NOT NULL,
  "actions" jsonb NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ticket_rules_position_nonnegative" CHECK ("position" >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_rules_position_uidx" ON "ticket_rules" ("position");

CREATE TABLE IF NOT EXISTS "ticket_rule_firings" (
  "id" text PRIMARY KEY NOT NULL,
  "ticket_id" text NOT NULL,
  "rule_id" text NOT NULL,
  "rule_position" integer NOT NULL,
  "result" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ticket_rule_firings_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade,
  CONSTRAINT "ticket_rule_firings_rule_id_ticket_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."ticket_rules"("id") ON DELETE restrict
);
CREATE INDEX IF NOT EXISTS "ticket_rule_firings_ticket_idx" ON "ticket_rule_firings" ("ticket_id", "created_at");

-- Tier 3 dynamic fields.
CREATE TABLE IF NOT EXISTS "dynamic_fields" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "field_type" text NOT NULL,
  "object_type" text NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "dynamic_fields_key_not_blank" CHECK (length(trim("key")) > 0),
  CONSTRAINT "dynamic_fields_label_not_blank" CHECK (length(trim("label")) > 0),
  CONSTRAINT "dynamic_fields_object_type_not_blank" CHECK (length(trim("object_type")) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "dynamic_fields_object_key_uidx" ON "dynamic_fields" ("object_type", "key");
CREATE INDEX IF NOT EXISTS "dynamic_fields_active_idx" ON "dynamic_fields" ("object_type", "is_active", "display_order");

CREATE TABLE IF NOT EXISTS "dynamic_field_values" (
  "field_id" text NOT NULL,
  "object_id" text NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "dynamic_field_values_field_id_dynamic_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."dynamic_fields"("id") ON DELETE restrict,
  CONSTRAINT "dynamic_field_values_object_not_blank" CHECK (length(trim("object_id")) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "dynamic_field_values_field_object_uidx" ON "dynamic_field_values" ("field_id", "object_id");
CREATE INDEX IF NOT EXISTS "dynamic_field_values_object_idx" ON "dynamic_field_values" ("object_id");

-- Tier 3 workflows, webhooks, and notifications.
CREATE TABLE IF NOT EXISTS "workflows" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "trigger_event" text NOT NULL,
  "conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "last_run_status" text,
  "last_run_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "workflows_trigger_idx" ON "workflows" ("is_active", "trigger_event");

CREATE TABLE IF NOT EXISTS "workflow_executions" (
  "id" text PRIMARY KEY NOT NULL,
  "workflow_id" text NOT NULL,
  "trigger_event" text NOT NULL,
  "record_type" text NOT NULL,
  "record_id" text NOT NULL,
  "status" text DEFAULT 'running' NOT NULL,
  "input" jsonb,
  "output" jsonb,
  "error" text,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "finished_at" timestamp,
  CONSTRAINT "workflow_executions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "workflow_executions_workflow_idx" ON "workflow_executions" ("workflow_id", "started_at");
CREATE INDEX IF NOT EXISTS "workflow_executions_record_idx" ON "workflow_executions" ("record_type", "record_id");

CREATE TABLE IF NOT EXISTS "workflow_scheduled_emissions" (
  "id" text PRIMARY KEY NOT NULL,
  "workflow_id" text NOT NULL,
  "execution_id" text,
  "idempotency_key" text NOT NULL,
  "record_type" text NOT NULL,
  "record_id" text NOT NULL,
  "emit_at" timestamp NOT NULL,
  "payload" jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "emitted_at" timestamp,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_scheduled_emissions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade,
  CONSTRAINT "workflow_scheduled_emissions_execution_id_workflow_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."workflow_executions"("id") ON DELETE set null
);
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_scheduled_emissions_idempotency_uidx" ON "workflow_scheduled_emissions" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "workflow_scheduled_emissions_due_idx" ON "workflow_scheduled_emissions" ("status", "emit_at");

CREATE TABLE IF NOT EXISTS "webhook_message_formats" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "content_type" text DEFAULT 'application/json' NOT NULL,
  "body_template" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "execution_id" text,
  "message_format_id" text,
  "url" text NOT NULL,
  "request_headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "request_body" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "next_attempt_at" timestamp,
  "response_status" integer,
  "response_headers" jsonb,
  "response_body" text,
  "last_error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  CONSTRAINT "webhook_deliveries_execution_id_workflow_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."workflow_executions"("id") ON DELETE set null,
  CONSTRAINT "webhook_deliveries_message_format_id_webhook_message_formats_id_fk" FOREIGN KEY ("message_format_id") REFERENCES "public"."webhook_message_formats"("id") ON DELETE set null,
  CONSTRAINT "webhook_deliveries_attempt_count_nonnegative" CHECK ("attempt_count" >= 0),
  CONSTRAINT "webhook_deliveries_max_attempts_positive" CHECK ("max_attempts" > 0),
  CONSTRAINT "webhook_deliveries_attempts_bounded" CHECK ("attempt_count" <= "max_attempts")
);
CREATE INDEX IF NOT EXISTS "webhook_deliveries_due_idx" ON "webhook_deliveries" ("status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "webhook_deliveries_execution_idx" ON "webhook_deliveries" ("execution_id", "created_at");

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "recipient_id" text NOT NULL,
  "actor_id" text,
  "record_type" text NOT NULL,
  "record_id" text NOT NULL,
  "event_type" text NOT NULL,
  "event_count" integer DEFAULT 1 NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "notifications_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade,
  CONSTRAINT "notifications_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null,
  CONSTRAINT "notifications_event_count_positive" CHECK ("event_count" > 0),
  CONSTRAINT "notifications_not_own_action" CHECK ("actor_id" IS NULL OR "actor_id" <> "recipient_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_recipient_record_event_uidx" ON "notifications" ("recipient_id", "record_type", "record_id", "event_type");
CREATE INDEX IF NOT EXISTS "notifications_recipient_unread_idx" ON "notifications" ("recipient_id", "read_at", "updated_at");

-- Tier 3 saved views and search projection.
CREATE TABLE IF NOT EXISTS "saved_views" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_type" text NOT NULL,
  "owner_id" text NOT NULL,
  "created_by_id" text NOT NULL,
  "name" text NOT NULL,
  "object_type" text,
  "filters" jsonb NOT NULL,
  "sort" jsonb,
  "columns" text[],
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "saved_views_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade,
  CONSTRAINT "saved_views_user_owner_check" CHECK ("owner_type" <> 'user' OR "owner_id" = "created_by_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "saved_views_owner_name_uidx" ON "saved_views" ("owner_type", "owner_id", "name");
CREATE INDEX IF NOT EXISTS "saved_views_creator_idx" ON "saved_views" ("created_by_id");

CREATE TABLE IF NOT EXISTS "search_documents" (
  "object_type" text NOT NULL,
  "object_id" text NOT NULL,
  "title" text NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "url" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_updated_at" timestamp NOT NULL,
  "indexed_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "search_documents_object_type_object_id_pk" PRIMARY KEY ("object_type", "object_id")
);
CREATE INDEX IF NOT EXISTS "search_documents_fts_idx" ON "search_documents" USING gin ((
  setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("body", '')), 'B')
));
CREATE INDEX IF NOT EXISTS "search_documents_changed_idx" ON "search_documents" ("object_type", "source_updated_at");

-- Tier 3 API keys. Only hashes are persisted.
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "prefix" text NOT NULL,
  "secret_hash" text NOT NULL,
  "capabilities" jsonb NOT NULL,
  "expires_at" timestamp NOT NULL,
  "last_used_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "api_keys_prefix_unique" UNIQUE ("prefix"),
  CONSTRAINT "api_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "api_keys_user_idx" ON "api_keys" ("user_id");
CREATE INDEX IF NOT EXISTS "api_keys_expires_idx" ON "api_keys" ("expires_at");

-- Verification (run manually after migration):
-- SELECT (SELECT count(*) FROM cmdb_items) AS legacy_rows,
--        (SELECT count(*) FROM cmdb_objects o JOIN cmdb_items i ON i.id = o.id) AS migrated_rows;
-- SELECT count(*) AS provenance_mismatches
-- FROM cmdb_items i JOIN cmdb_objects o ON o.id = i.id
-- WHERE o.source_ticket_id IS DISTINCT FROM i.source_ticket_id
--    OR o.source_run_id IS DISTINCT FROM i.source_run_id
--    OR o.source_step_id IS DISTINCT FROM i.source_step_id
--    OR o.observed_at IS DISTINCT FROM i.observed_at;
-- SELECT i.kind, c.key AS mapped_class, count(*)
-- FROM cmdb_items i JOIN cmdb_objects o ON o.id = i.id JOIN cmdb_classes c ON c.id = o.class_id
-- GROUP BY i.kind, c.key ORDER BY i.kind;

COMMIT;
