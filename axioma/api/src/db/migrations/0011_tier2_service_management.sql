CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint

CREATE TABLE "forms" (
  "id" text PRIMARY KEY NOT NULL, "key" text NOT NULL, "version" integer NOT NULL,
  "name" text NOT NULL, "description" text, "status" text DEFAULT 'draft' NOT NULL,
  "created_by_id" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL,
  "published_at" timestamp, CONSTRAINT "forms_version_positive" CHECK ("version" > 0),
  CONSTRAINT "forms_key_version_uidx" UNIQUE("key", "version")
);--> statement-breakpoint
CREATE INDEX "forms_status_idx" ON "forms" ("status");--> statement-breakpoint
CREATE TABLE "form_fields" (
  "id" text PRIMARY KEY NOT NULL, "form_id" text NOT NULL REFERENCES "forms"("id") ON DELETE cascade,
  "key" text NOT NULL, "label" text NOT NULL, "description" text, "type" text NOT NULL,
  "ordinal" integer NOT NULL, "options" jsonb, "validation" jsonb, "condition" jsonb,
  "is_mandatory" boolean DEFAULT false NOT NULL, "is_hidden" boolean DEFAULT false NOT NULL,
  "is_readonly" boolean DEFAULT false NOT NULL, "predefined_value" jsonb,
  CONSTRAINT "form_fields_ordinal_nonnegative" CHECK ("ordinal" >= 0),
  CONSTRAINT "form_fields_form_key_uidx" UNIQUE("form_id", "key"),
  CONSTRAINT "form_fields_form_ordinal_uidx" UNIQUE("form_id", "ordinal")
);--> statement-breakpoint

CREATE TABLE "service_families" (
  "id" text PRIMARY KEY NOT NULL, "name" text NOT NULL UNIQUE, "description" text,
  "is_active" boolean DEFAULT true NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "services" (
  "id" text PRIMARY KEY NOT NULL, "family_id" text NOT NULL REFERENCES "service_families"("id") ON DELETE cascade,
  "name" text NOT NULL, "description" text, "sla_id" text REFERENCES "slas"("id") ON DELETE set null,
  "ola_id" text REFERENCES "olas"("id") ON DELETE set null, "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "services_family_name_uidx" UNIQUE("family_id", "name")
);--> statement-breakpoint
CREATE INDEX "services_sla_idx" ON "services"("sla_id");--> statement-breakpoint
CREATE INDEX "services_ola_idx" ON "services"("ola_id");--> statement-breakpoint
CREATE TABLE "service_subcategories" (
  "id" text PRIMARY KEY NOT NULL, "service_id" text NOT NULL REFERENCES "services"("id") ON DELETE cascade,
  "name" text NOT NULL, "description" text, "approver_override_id" text REFERENCES "user"("id") ON DELETE set null,
  "form_id" text REFERENCES "forms"("id") ON DELETE set null, "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "service_subcategories_service_name_uidx" UNIQUE("service_id", "name"),
  CONSTRAINT "service_subcategories_id_service_uidx" UNIQUE("id", "service_id")
);--> statement-breakpoint

INSERT INTO "service_families" ("id","name","description") VALUES
 ('sf-operations','IT Operations','Migrated MVP classifications'),
 ('sf-general','General Support','Fallback for previously unclassified tickets') ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "services" ("id","family_id","name") VALUES
 ('svc-infrastructure','sf-operations','Infrastructure'),('svc-device','sf-operations','Device'),
 ('svc-access','sf-operations','Access'),('svc-general','sf-general','General') ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "service_subcategories" ("id","service_id","name") VALUES
 ('ss-deployment','svc-infrastructure','Deployment'),('ss-network','svc-device','Network'),
 ('ss-account','svc-access','Account'),('ss-general','svc-general','General') ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "service_id" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "service_subcategory_id" text;--> statement-breakpoint
UPDATE "tickets" SET
 "service_id" = CASE "category" WHEN 'infrastructure' THEN 'svc-infrastructure' WHEN 'device' THEN 'svc-device' WHEN 'access' THEN 'svc-access' ELSE 'svc-general' END,
 "service_subcategory_id" = CASE "category" WHEN 'infrastructure' THEN 'ss-deployment' WHEN 'device' THEN 'ss-network' WHEN 'access' THEN 'ss-account' ELSE 'ss-general' END;--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "service_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "service_subcategory_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_service_fk" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_subcategory_service_fk" FOREIGN KEY ("service_subcategory_id","service_id") REFERENCES "service_subcategories"("id","service_id") ON DELETE restrict;--> statement-breakpoint
CREATE INDEX "tickets_service_idx" ON "tickets"("service_id","service_subcategory_id");--> statement-breakpoint

CREATE TABLE "problems" (
  "id" text PRIMARY KEY NOT NULL, "problem_number" text NOT NULL UNIQUE, "title" text NOT NULL,
  "description" text NOT NULL, "status" text DEFAULT 'open' NOT NULL REFERENCES "ticket_statuses"("key"),
  "priority" text DEFAULT 'P3' NOT NULL, "assignee_id" text REFERENCES "user"("id") ON DELETE set null,
  "root_cause" text, "workaround" text, "is_known_error" boolean DEFAULT false NOT NULL,
  "service_id" text REFERENCES "services"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "problems_known_error_idx" ON "problems"("is_known_error","status");--> statement-breakpoint
CREATE TABLE "problem_tickets" (
  "problem_id" text NOT NULL REFERENCES "problems"("id") ON DELETE cascade,
  "ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,
  "created_at" timestamp DEFAULT now() NOT NULL, PRIMARY KEY("problem_id","ticket_id")
);--> statement-breakpoint
CREATE INDEX "problem_tickets_ticket_idx" ON "problem_tickets"("ticket_id");--> statement-breakpoint

CREATE TABLE "changes" (
  "id" text PRIMARY KEY NOT NULL, "change_number" text NOT NULL UNIQUE, "title" text NOT NULL,
  "description" text, "reason_for_change" text, "change_type" text DEFAULT 'normal' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL, "priority" text DEFAULT 'P3' NOT NULL,
  "impact" text DEFAULT 'medium' NOT NULL, "category" text, "requester_id" text REFERENCES "user"("id") ON DELETE set null,
  "assigned_to_id" text REFERENCES "user"("id") ON DELETE set null, "approver_id" text REFERENCES "user"("id") ON DELETE set null,
  "approval_at" timestamp, "work_start_at" timestamp, "work_end_at" timestamp, "outage_start_at" timestamp,
  "outage_end_at" timestamp, "implementation_plan" text, "test_plan" text, "rollback_plan" text,
  "risk_evaluation" text, "risk_likelihood" integer, "risk_impact_score" integer, "risk_score" integer,
  "risk_level" text, "cab_required" boolean DEFAULT false NOT NULL, "cab_approval_type" text DEFAULT 'all' NOT NULL,
  "pir_review" text, "pir_was_successful" boolean, "pir_actual_start_at" timestamp, "pir_actual_end_at" timestamp,
  "pir_lessons_learned" text, "pir_follow_up" text, "created_by_id" text REFERENCES "user"("id") ON DELETE set null,
  "source_run_id" text REFERENCES "agent_runs"("id") ON DELETE set null,
  "source_step_id" text REFERENCES "agent_steps"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "changes_work_range" CHECK ("work_end_at" IS NULL OR "work_start_at" IS NULL OR "work_end_at" >= "work_start_at"),
  CONSTRAINT "changes_outage_range" CHECK ("outage_end_at" IS NULL OR "outage_start_at" IS NULL OR "outage_end_at" >= "outage_start_at"),
  CONSTRAINT "changes_pir_range" CHECK ("pir_actual_end_at" IS NULL OR "pir_actual_start_at" IS NULL OR "pir_actual_end_at" >= "pir_actual_start_at")
);--> statement-breakpoint
CREATE INDEX "changes_status_schedule_idx" ON "changes"("status","work_start_at");--> statement-breakpoint
CREATE TABLE "change_cab_members" (
 "id" text PRIMARY KEY NOT NULL, "change_id" text NOT NULL REFERENCES "changes"("id") ON DELETE cascade,
 "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade, "is_required" boolean DEFAULT true NOT NULL,
 "created_at" timestamp DEFAULT now() NOT NULL, UNIQUE("change_id","user_id")
);--> statement-breakpoint
CREATE TABLE "change_cab_votes" (
 "id" text PRIMARY KEY NOT NULL, "member_id" text NOT NULL UNIQUE REFERENCES "change_cab_members"("id") ON DELETE cascade,
 "vote" text NOT NULL, "comment" text, "voted_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "change_ticket_links" (
 "id" text PRIMARY KEY NOT NULL, "change_id" text NOT NULL REFERENCES "changes"("id") ON DELETE cascade,
 "ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE cascade, "link_type" text DEFAULT 'related' NOT NULL,
 "created_at" timestamp DEFAULT now() NOT NULL, UNIQUE("change_id","ticket_id","link_type")
);--> statement-breakpoint
CREATE TABLE "change_transitions" (
 "id" text PRIMARY KEY NOT NULL, "change_id" text NOT NULL REFERENCES "changes"("id") ON DELETE cascade,
 "from_status" text NOT NULL, "to_status" text NOT NULL, "actor_type" text NOT NULL, "actor_id" text,
 "run_id" text REFERENCES "agent_runs"("id") ON DELETE set null, "step_id" text REFERENCES "agent_steps"("id") ON DELETE set null,
 "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "knowledge_folders" (
 "id" text PRIMARY KEY NOT NULL, "parent_id" text, "name" text NOT NULL, "description" text,
 "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL,
 FOREIGN KEY ("parent_id") REFERENCES "knowledge_folders"("id") ON DELETE set null
);--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_folders_root_name_uidx" ON "knowledge_folders"("name") WHERE "parent_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_folders_parent_name_uidx" ON "knowledge_folders"("parent_id","name") WHERE "parent_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE "knowledge_articles" (
 "id" text PRIMARY KEY NOT NULL, "folder_id" text REFERENCES "knowledge_folders"("id") ON DELETE set null,
 "author_id" text REFERENCES "user"("id") ON DELETE set null, "title" text NOT NULL, "body" text NOT NULL,
 "summary" text, "status" text DEFAULT 'draft' NOT NULL, "audience" text DEFAULT 'employees' NOT NULL,
 "is_restricted" boolean DEFAULT false NOT NULL, "current_version" integer DEFAULT 1 NOT NULL,
 "embedding" vector(1536), "embedding_model" text, "metadata" jsonb, "published_at" timestamp,
 "next_review_at" timestamp, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL,
 CONSTRAINT "knowledge_articles_version_positive" CHECK ("current_version" > 0)
);--> statement-breakpoint
CREATE INDEX "knowledge_articles_publication_idx" ON "knowledge_articles"("status","audience","is_restricted");--> statement-breakpoint
CREATE INDEX "knowledge_articles_lexical_idx" ON "knowledge_articles" USING gin (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("body", '')));--> statement-breakpoint
CREATE TABLE "knowledge_article_versions" (
 "id" text PRIMARY KEY NOT NULL, "article_id" text NOT NULL REFERENCES "knowledge_articles"("id") ON DELETE cascade,
 "version" integer NOT NULL, "title" text NOT NULL, "body" text NOT NULL, "summary" text,
 "author_id" text REFERENCES "user"("id") ON DELETE set null, "change_note" text,
 "created_at" timestamp DEFAULT now() NOT NULL, UNIQUE("article_id","version")
);--> statement-breakpoint
CREATE TABLE "knowledge_tags" ("id" text PRIMARY KEY NOT NULL, "name" text NOT NULL UNIQUE);--> statement-breakpoint
CREATE TABLE "knowledge_article_tags" (
 "article_id" text NOT NULL REFERENCES "knowledge_articles"("id") ON DELETE cascade,
 "tag_id" text NOT NULL REFERENCES "knowledge_tags"("id") ON DELETE cascade, PRIMARY KEY("article_id","tag_id")
);--> statement-breakpoint
CREATE TABLE "knowledge_acl" (
 "id" text PRIMARY KEY NOT NULL, "article_id" text REFERENCES "knowledge_articles"("id") ON DELETE cascade,
 "folder_id" text REFERENCES "knowledge_folders"("id") ON DELETE cascade, "principal_type" text NOT NULL,
 "principal_id" text NOT NULL, "permission" text DEFAULT 'read' NOT NULL,
 CONSTRAINT "knowledge_acl_one_target_check" CHECK (("article_id" IS NOT NULL) <> ("folder_id" IS NOT NULL))
);--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_acl_article_grant_uidx" ON "knowledge_acl"("article_id","principal_type","principal_id","permission") WHERE "article_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_acl_folder_grant_uidx" ON "knowledge_acl"("folder_id","principal_type","principal_id","permission") WHERE "folder_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE "knowledge_gap_clusters" (
 "id" text PRIMARY KEY NOT NULL, "label" text NOT NULL, "description" text, "keywords" text[],
 "status" text DEFAULT 'open' NOT NULL, "article_id" text REFERENCES "knowledge_articles"("id") ON DELETE set null,
 "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "knowledge_gap_tickets" (
 "cluster_id" text NOT NULL REFERENCES "knowledge_gap_clusters"("id") ON DELETE cascade,
 "ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,
 "created_at" timestamp DEFAULT now() NOT NULL, PRIMARY KEY("cluster_id","ticket_id")
);--> statement-breakpoint

CREATE TABLE "form_submissions" (
 "id" text PRIMARY KEY NOT NULL, "form_id" text NOT NULL REFERENCES "forms"("id") ON DELETE restrict,
 "submitter_id" text REFERENCES "user"("id") ON DELETE set null, "ticket_id" text REFERENCES "tickets"("id") ON DELETE set null,
 "values" jsonb NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "form_submissions_ticket_idx" ON "form_submissions"("ticket_id","created_at");--> statement-breakpoint
CREATE TABLE "approvals" (
 "id" text PRIMARY KEY NOT NULL, "requester_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
 "approver_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict, "ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,
 "submission_id" text REFERENCES "form_submissions"("id") ON DELETE set null, "status" text DEFAULT 'waiting_for_approval' NOT NULL,
 "request_note" text, "decision_note" text, "requested_at" timestamp DEFAULT now() NOT NULL, "decided_at" timestamp
);--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_active_ticket_uidx" ON "approvals"("ticket_id") WHERE "status" = 'waiting_for_approval';--> statement-breakpoint
CREATE INDEX "approvals_approver_status_idx" ON "approvals"("approver_id","status","requested_at");--> statement-breakpoint
INSERT INTO "role_capabilities" ("role_id", "capability") VALUES
 ('it-analyst','problem.manage'),('it-analyst','change.manage'),('it-analyst','change.approve'),
 ('it-analyst','knowledge.read'),('it-analyst','knowledge.manage'),('it-analyst','approval.read'),
 ('it-analyst','approval.decide'),('it-analyst','catalogue.manage') ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "role_capabilities" ("role_id", "capability")
SELECT 'platform-engineer', "capability" FROM "role_capabilities" WHERE "role_id" = 'it-analyst'
ON CONFLICT DO NOTHING;
