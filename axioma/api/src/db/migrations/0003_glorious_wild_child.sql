ALTER TABLE "approvals" DROP CONSTRAINT "approvals_requester_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "approvals" DROP CONSTRAINT "approvals_approver_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "device_command_proposals" DROP CONSTRAINT "device_command_proposals_approved_by_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "directory_identities" DROP CONSTRAINT "directory_identities_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "ticket_merges" DROP CONSTRAINT "ticket_merges_source_ticket_id_tickets_id_fk";
--> statement-breakpoint
ALTER TABLE "ticket_merges" DROP CONSTRAINT "ticket_merges_target_ticket_id_tickets_id_fk";
--> statement-breakpoint
ALTER TABLE "ticket_number_history" DROP CONSTRAINT "ticket_number_history_ticket_id_tickets_id_fk";
--> statement-breakpoint
DROP INDEX "search_documents_embedding_idx";--> statement-breakpoint
ALTER TABLE "search_reconciliation_state" ALTER COLUMN "last_reconciled_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "claim_code_hash" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "claim_code_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_id_user_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_command_proposals" ADD CONSTRAINT "device_command_proposals_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_identities" ADD CONSTRAINT "directory_identities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_merges" ADD CONSTRAINT "ticket_merges_source_ticket_id_tickets_id_fk" FOREIGN KEY ("source_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_merges" ADD CONSTRAINT "ticket_merges_target_ticket_id_tickets_id_fk" FOREIGN KEY ("target_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_number_history" ADD CONSTRAINT "ticket_number_history_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_runs_ended_at_idx" ON "agent_runs" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX "agent_runs_environment_idx" ON "agent_runs" USING btree ("environment_id");--> statement-breakpoint
CREATE INDEX "agent_runs_started_by_idx" ON "agent_runs" USING btree ("started_by_id");--> statement-breakpoint
CREATE INDEX "api_key_rate_limits_window_idx" ON "api_key_rate_limits" USING btree ("window_started_at");--> statement-breakpoint
CREATE INDEX "assets_updated_at_idx" ON "assets" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "calendars_default_uidx" ON "calendars" USING btree ("is_default") WHERE "calendars"."is_default" = true;--> statement-breakpoint
CREATE INDEX "changes_updated_at_idx" ON "changes" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "cmdb_objects_observed_at_idx" ON "cmdb_objects" USING btree ("observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_claim_code_uidx" ON "devices" USING btree ("claim_code_hash");--> statement-breakpoint
CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "knowledge_articles_updated_at_idx" ON "knowledge_articles" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "problems_updated_at_idx" ON "problems" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "search_documents_embedding_article_idx" ON "search_documents" USING hnsw ("embedding" vector_cosine_ops) WHERE "search_documents"."object_type" = 'knowledge_article';--> statement-breakpoint
CREATE INDEX "search_documents_embedding_agent_idx" ON "search_documents" USING hnsw ("embedding" vector_cosine_ops) WHERE "search_documents"."object_type" in ('resolved_ticket', 'agent_run', 'known_error', 'document');--> statement-breakpoint
CREATE INDEX "search_documents_metadata_idx" ON "search_documents" USING gin ("metadata" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "tickets_updated_at_idx" ON "tickets" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_statuses_default_uidx" ON "ticket_statuses" USING btree ("is_default") WHERE "ticket_statuses"."is_default" = true;--> statement-breakpoint
ALTER TABLE "knowledge_articles" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "knowledge_articles" DROP COLUMN "embedding_model";