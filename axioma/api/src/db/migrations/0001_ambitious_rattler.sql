CREATE TABLE IF NOT EXISTS "ticket_transitions" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"action" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ticket_transitions" ADD CONSTRAINT "ticket_transitions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_transitions_ticket_idx" ON "ticket_transitions" USING btree ("ticket_id","created_at");