UPDATE "cmdb_items" SET "source_ticket_id" = NULL WHERE "source_ticket_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "tickets" WHERE "tickets"."id" = "cmdb_items"."source_ticket_id");--> statement-breakpoint
UPDATE "cmdb_items" SET "source_run_id" = NULL WHERE "source_run_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "agent_runs" WHERE "agent_runs"."id" = "cmdb_items"."source_run_id");--> statement-breakpoint
UPDATE "cmdb_items" SET "source_step_id" = NULL WHERE "source_step_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "agent_steps" WHERE "agent_steps"."id" = "cmdb_items"."source_step_id");--> statement-breakpoint
UPDATE "device_commands" SET "run_id" = NULL WHERE "run_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "agent_runs" WHERE "agent_runs"."id" = "device_commands"."run_id");--> statement-breakpoint
UPDATE "device_commands" SET "step_id" = NULL WHERE "step_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "agent_steps" WHERE "agent_steps"."id" = "device_commands"."step_id");--> statement-breakpoint
ALTER TABLE "cmdb_items" ADD CONSTRAINT "cmdb_items_source_ticket_id_tickets_id_fk" FOREIGN KEY ("source_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cmdb_items" ADD CONSTRAINT "cmdb_items_source_run_id_agent_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cmdb_items" ADD CONSTRAINT "cmdb_items_source_step_id_agent_steps_id_fk" FOREIGN KEY ("source_step_id") REFERENCES "public"."agent_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_step_id_agent_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."agent_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cmdb_items_run_idx" ON "cmdb_items" USING btree ("source_run_id");--> statement-breakpoint
CREATE INDEX "cmdb_items_step_idx" ON "cmdb_items" USING btree ("source_step_id");--> statement-breakpoint
CREATE INDEX "device_commands_run_idx" ON "device_commands" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "device_commands_step_idx" ON "device_commands" USING btree ("step_id");