CREATE TABLE "ticket_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"intent" text,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_draft" jsonb,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"field_sources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"subcategory_id" text,
	"form_id" text,
	"ticket_id" text,
	"model" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticket_drafts" ADD CONSTRAINT "ticket_drafts_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_drafts" ADD CONSTRAINT "ticket_drafts_subcategory_id_service_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."service_subcategories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_drafts" ADD CONSTRAINT "ticket_drafts_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_drafts" ADD CONSTRAINT "ticket_drafts_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_drafts_reporter_status_idx" ON "ticket_drafts" USING btree ("reporter_id","status","updated_at");