ALTER TABLE "agent_runs" ADD COLUMN "started_by_id" text;
--> statement-breakpoint
ALTER TABLE "device_command_proposals" ADD COLUMN "requested_by_id" text;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_started_by_id_user_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "device_command_proposals" ADD CONSTRAINT "device_command_proposals_requested_by_id_user_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
