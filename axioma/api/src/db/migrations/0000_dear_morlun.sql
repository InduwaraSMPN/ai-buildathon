CREATE TABLE IF NOT EXISTS "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"model" text,
	"outcome" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"kind" text NOT NULL,
	"reasoning" text,
	"tool_name" text,
	"tool_input" jsonb,
	"tool_output" jsonb,
	"error" text,
	"evidence" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cmdb_items" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"attributes" jsonb,
	"relates_to_id" text,
	"relation_kind" text,
	"source_ticket_id" text,
	"source_run_id" text,
	"source_step_id" text,
	"observed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "device_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"run_id" text,
	"step_id" text,
	"sequence" integer NOT NULL,
	"tool" text NOT NULL,
	"input" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"output" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"dispatched_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"hostname" text NOT NULL,
	"username" text,
	"platform" text,
	"release" text,
	"agent_version" text,
	"enrolment_code" text,
	"enrolment_code_expires_at" timestamp,
	"connected" text DEFAULT 'offline' NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"device_id" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"record_type" text DEFAULT 'incident' NOT NULL,
	"impact" text DEFAULT 'medium' NOT NULL,
	"urgency" text DEFAULT 'medium' NOT NULL,
	"priority" text DEFAULT 'P3' NOT NULL,
	"category" text,
	"subcategory" text,
	"status" text DEFAULT 'open' NOT NULL,
	"route" text,
	"resolution" text,
	"escalation_note" text,
	"reporter_note" text,
	"progress_marker" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"reopened_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "record_type" text DEFAULT 'incident' NOT NULL, ADD COLUMN IF NOT EXISTS "impact" text DEFAULT 'medium' NOT NULL, ADD COLUMN IF NOT EXISTS "urgency" text DEFAULT 'medium' NOT NULL, ADD COLUMN IF NOT EXISTS "priority" text DEFAULT 'P3' NOT NULL, ADD COLUMN IF NOT EXISTS "category" text, ADD COLUMN IF NOT EXISTS "subcategory" text, ADD COLUMN IF NOT EXISTS "resolved_at" timestamp, ADD COLUMN IF NOT EXISTS "progress_marker" text, ADD COLUMN IF NOT EXISTS "escalation_note" text, ADD COLUMN IF NOT EXISTS "reporter_note" text, ADD COLUMN IF NOT EXISTS "reopened_at" timestamp;--> statement-breakpoint
ALTER TABLE "agent_steps" ADD COLUMN IF NOT EXISTS "evidence" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "enrolment_code" text, ADD COLUMN IF NOT EXISTS "enrolment_code_expires_at" timestamp;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "devices" ADD CONSTRAINT "devices_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tickets" ADD CONSTRAINT "tickets_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_ticket_idx" ON "agent_runs" USING btree ("ticket_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_steps_run_ordinal_uidx" ON "agent_steps" USING btree ("run_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cmdb_items_lookup_idx" ON "cmdb_items" USING btree ("kind","external_id","observed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cmdb_items_relation_idx" ON "cmdb_items" USING btree ("relates_to_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cmdb_items_source_idx" ON "cmdb_items" USING btree ("source_ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "device_commands_seq_idx" ON "device_commands" USING btree ("device_id","sequence");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_commands_status_idx" ON "device_commands" USING btree ("device_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_owner_idx" ON "devices" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_connected_idx" ON "devices" USING btree ("connected");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "devices_enrolment_code_uidx" ON "devices" USING btree ("enrolment_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_reporter_idx" ON "tickets" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_status_idx" ON "tickets" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_priority_idx" ON "tickets" USING btree ("priority","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_type_idx" ON "tickets" USING btree ("record_type","status");