ALTER TABLE "agent_steps" ADD COLUMN "notice" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_steps" ADD COLUMN "evidence_tone" text DEFAULT 'neutral' NOT NULL;
