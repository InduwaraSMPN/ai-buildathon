CREATE TABLE IF NOT EXISTS "ticket_statuses" (
  "key" text PRIMARY KEY, "label" text NOT NULL, "state_type" text NOT NULL,
  "is_closed" boolean DEFAULT false NOT NULL, "pauses_sla" boolean DEFAULT false NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL, "colour" text, "display_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_status_transitions" (
  "from_status" text NOT NULL REFERENCES "ticket_statuses"("key") ON DELETE cascade,
  "action" text NOT NULL,
  "to_status" text NOT NULL REFERENCES "ticket_statuses"("key") ON DELETE cascade,
  UNIQUE ("from_status", "action")
);
--> statement-breakpoint
INSERT INTO "ticket_statuses" ("key","label","state_type","is_closed","pauses_sla","is_default","colour","display_order") VALUES
 ('open','Open','new',false,false,true,'blue',10), ('routing','Routing','open',false,false,false,'blue',20),
 ('resolving','Resolving','open',false,false,false,'blue',30), ('pending','Waiting for reply','pending',false,true,false,'amber',40),
 ('resolved','Resolved','resolved',false,false,false,'green',50), ('escalated','Escalated','open',false,false,false,'red',60),
 ('closed','Closed','closed',true,false,false,'slate',70) ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "ticket_status_transitions" ("from_status","action","to_status") VALUES
 ('open','startRun','routing'),('open','reclassify','open'),('open','assign','open'),('open','add_detail','open'),('open','pend','pending'),
 ('routing','firstTool','resolving'),('routing','reclassify','routing'),('routing','assign','routing'),('routing','add_detail','routing'),('routing','pend','pending'),
 ('resolving','resolve','resolved'),('resolving','reclassify','resolving'),('resolving','assign','resolving'),('resolving','add_detail','resolving'),('resolving','escalate','escalated'),('resolving','fail','escalated'),('resolving','exhaust','escalated'),('resolving','pend','pending'),
 ('pending','unpend','open'),('pending','add_detail','pending'),('pending','resolve','resolved'),
 ('resolved','close','closed'),('resolved','escalate','escalated'),('resolved','reclassify','resolved'),('resolved','assign','resolved'),
 ('escalated','startRun','routing'),('escalated','close','closed'),('escalated','escalate','escalated'),('escalated','reclassify','escalated'),('escalated','assign','escalated'),
 ('closed','reopen','open') ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendars" ("id" text PRIMARY KEY,"name" text NOT NULL,"timezone" text NOT NULL,"is_default" boolean DEFAULT false NOT NULL);
CREATE TABLE IF NOT EXISTS "calendar_hours" ("id" text PRIMARY KEY,"calendar_id" text NOT NULL REFERENCES "calendars"("id") ON DELETE cascade,"weekday" integer NOT NULL,"start_time" time NOT NULL,"end_time" time NOT NULL);
CREATE TABLE IF NOT EXISTS "calendar_holidays" ("id" text PRIMARY KEY,"calendar_id" text NOT NULL REFERENCES "calendars"("id") ON DELETE cascade,"date" date NOT NULL,"name" text NOT NULL,UNIQUE("calendar_id","date"));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pending_reasons" ("id" text PRIMARY KEY,"name" text NOT NULL,"followup_frequency_minutes" integer NOT NULL,"followups_before_resolution" integer NOT NULL);
CREATE TABLE IF NOT EXISTS "pending_followups" ("id" text PRIMARY KEY,"ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,"reason_id" text NOT NULL REFERENCES "pending_reasons"("id"),"ordinal" integer NOT NULL,"created_at" timestamp DEFAULT now() NOT NULL);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "resolution_code" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "assignee_id" text REFERENCES "user"("id") ON DELETE set null;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "owner_id" text REFERENCES "user"("id") ON DELETE set null;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "team_id" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "merged_into_id" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "number" text UNIQUE;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "pending_reason_id" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "pending_until" timestamp;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "last_pending_at" timestamp;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "pending_followups" integer DEFAULT 0 NOT NULL;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "escalation_flag" text DEFAULT 'none' NOT NULL;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "escalation_reason" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_messages" ("id" text PRIMARY KEY,"ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,"author_id" text REFERENCES "user"("id") ON DELETE set null,"author_type" text NOT NULL,"body" text NOT NULL,"visibility" text DEFAULT 'public' NOT NULL,"created_at" timestamp DEFAULT now() NOT NULL);
CREATE INDEX IF NOT EXISTS "ticket_messages_ticket_idx" ON "ticket_messages" ("ticket_id","created_at");
INSERT INTO "ticket_messages" ("id","ticket_id","author_id","author_type","body","visibility","created_at") SELECT 'legacy-note-' || md5("id"),"id","reporter_id",'reporter',"reporter_note",'public',"updated_at" FROM "tickets" WHERE "reporter_note" IS NOT NULL AND btrim("reporter_note") <> '' ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN IF EXISTS "reporter_note";
CREATE TABLE IF NOT EXISTS "ticket_links" ("id" text PRIMARY KEY,"ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,"target_ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,"relation_type" text NOT NULL,"created_by" text NOT NULL,"created_at" timestamp DEFAULT now() NOT NULL,UNIQUE("ticket_id","target_ticket_id","relation_type"),CHECK("ticket_id" <> "target_ticket_id"));
CREATE TABLE IF NOT EXISTS "ticket_merges" ("id" text PRIMARY KEY,"source_ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE restrict,"target_ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE restrict,"source_previous_status" text NOT NULL,"merged_by" text NOT NULL,"merged_at" timestamp DEFAULT now() NOT NULL,"undone_by" text,"undone_at" timestamp,CHECK("source_ticket_id" <> "target_ticket_id"));
CREATE TABLE IF NOT EXISTS "ticket_audit" ("id" text PRIMARY KEY,"ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,"field_name" text NOT NULL,"old_value" jsonb,"new_value" jsonb,"actor_id" text NOT NULL,"created_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "ticket_time_entries" ("id" text PRIMARY KEY,"ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,"user_id" text NOT NULL,"minutes" integer NOT NULL CHECK("minutes" > 0),"note" text NOT NULL,"created_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "ticket_number_counters" ("prefix" text NOT NULL,"year" text NOT NULL,"last_value" bigint NOT NULL,PRIMARY KEY("prefix","year"));
CREATE TABLE IF NOT EXISTS "ticket_number_history" ("number" text PRIMARY KEY,"ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE restrict,"created_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "ticket_presence" ("ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,"last_seen_at" timestamp DEFAULT now() NOT NULL,"expires_at" timestamp NOT NULL,PRIMARY KEY("ticket_id","user_id"));
CREATE TABLE IF NOT EXISTS "ticket_csat_responses" ("id" text PRIMARY KEY,"ticket_id" text NOT NULL UNIQUE REFERENCES "tickets"("id") ON DELETE cascade,"token" text NOT NULL UNIQUE,"rating" integer,"comment" text,"created_at" timestamp DEFAULT now() NOT NULL,"responded_at" timestamp,CHECK("rating" IS NULL OR "rating" BETWEEN 1 AND 5));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "slas" ("id" text PRIMARY KEY,"name" text NOT NULL,"priority" text,"tto_working_minutes" integer NOT NULL,"ttr_working_minutes" integer NOT NULL,"calendar_id" text NOT NULL REFERENCES "calendars"("id"),"is_default" boolean DEFAULT false NOT NULL,"created_at" timestamp DEFAULT now() NOT NULL,"updated_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "olas" (LIKE "slas" INCLUDING ALL);
CREATE TABLE IF NOT EXISTS "ticket_stopwatches" ("id" text PRIMARY KEY,"ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,"policy_type" text NOT NULL,"policy_id" text NOT NULL,"target_type" text NOT NULL,"accumulated_ms" bigint DEFAULT 0 NOT NULL,"pending_ms" bigint DEFAULT 0 NOT NULL,"running" boolean DEFAULT true NOT NULL,"started_at" timestamp NOT NULL,"created_at" timestamp DEFAULT now() NOT NULL,"updated_at" timestamp DEFAULT now() NOT NULL,UNIQUE("ticket_id","policy_type","target_type"));
CREATE TABLE IF NOT EXISTS "sla_notification_rules" ("id" text PRIMARY KEY,"name" text NOT NULL,"policy_type" text NOT NULL,"policy_id" text NOT NULL,"trigger_type" text NOT NULL,"target_type" text NOT NULL,"threshold_percent" integer DEFAULT 100 NOT NULL,"recipient_type" text NOT NULL,"recipient" text,"enabled" boolean DEFAULT true NOT NULL,"created_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "sla_escalation_events" ("id" text PRIMARY KEY,"idempotency_key" text NOT NULL UNIQUE,"ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,"stopwatch_id" text NOT NULL REFERENCES "ticket_stopwatches"("id") ON DELETE cascade,"rule_id" text REFERENCES "sla_notification_rules"("id") ON DELETE set null,"trigger_type" text NOT NULL,"target_type" text NOT NULL,"reason" text NOT NULL,"created_at" timestamp DEFAULT now() NOT NULL);
--> statement-breakpoint
INSERT INTO "calendars" ("id","name","timezone","is_default") VALUES ('default-business-hours','Default business hours','UTC',true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "calendar_hours" ("id","calendar_id","weekday","start_time","end_time") SELECT 'default-hours-' || d,'default-business-hours',d,'09:00','17:00' FROM generate_series(1,5) d ON CONFLICT ("id") DO NOTHING;
INSERT INTO "slas" ("id","name","priority","tto_working_minutes","ttr_working_minutes","calendar_id","is_default") VALUES ('default-sla','Default SLA',NULL,480,2400,'default-business-hours',true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "olas" ("id","name","priority","tto_working_minutes","ttr_working_minutes","calendar_id","is_default") VALUES ('default-ola','Default OLA',NULL,240,1440,'default-business-hours',true) ON CONFLICT ("id") DO NOTHING;
