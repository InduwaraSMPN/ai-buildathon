CREATE TABLE IF NOT EXISTS "device_command_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"run_id" text,
	"step_id" text,
	"command" jsonb NOT NULL,
	"digest" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"approved_by_id" text,
	"decided_at" timestamp,
	"decision_note" text,
	"expires_at" timestamp NOT NULL,
	"dispatched_command_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_command_proposals_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "device_command_proposals_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "device_command_proposals_step_id_agent_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."agent_steps"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "device_command_proposals_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_command_proposals_status_idx" ON "device_command_proposals" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_command_proposals_device_idx" ON "device_command_proposals" USING btree ("device_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_command_proposals_ticket_idx" ON "device_command_proposals" USING btree ("ticket_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_command_proposals_run_idx" ON "device_command_proposals" USING btree ("run_id");
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "execution_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "device_commands" ADD COLUMN IF NOT EXISTS "proposal_id" text;
--> statement-breakpoint
ALTER TABLE "role_capabilities" DROP CONSTRAINT "role_capabilities_key_check";
--> statement-breakpoint
ALTER TABLE "role_capabilities" ADD CONSTRAINT "role_capabilities_key_check" CHECK ("capability" in ('ticket.read.own', 'ticket.read.all', 'ticket.create', 'ticket.update', 'ticket.resolve', 'ticket.close', 'ticket.escalate', 'ticket.reclassify', 'ticket.assign', 'ticket.reopen', 'run.start', 'run.cancel', 'run.read', 'device.read', 'device.enroll', 'device.command', 'stats.read', 'problem.manage', 'change.manage', 'change.approve', 'knowledge.read', 'knowledge.manage', 'approval.read', 'approval.decide', 'catalogue.manage', 'admin.roles', 'admin.settings', 'admin.environments', 'admin.connectors', 'device.approve'));
--> statement-breakpoint
ALTER TABLE "role_grants" DROP CONSTRAINT "role_grants_capability_check";
--> statement-breakpoint
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_capability_check" CHECK ("target_type" <> 'capability' or "target_id" in ('ticket.read.own', 'ticket.read.all', 'ticket.create', 'ticket.update', 'ticket.resolve', 'ticket.close', 'ticket.escalate', 'ticket.reclassify', 'ticket.assign', 'ticket.reopen', 'run.start', 'run.cancel', 'run.read', 'device.read', 'device.enroll', 'device.command', 'stats.read', 'problem.manage', 'change.manage', 'change.approve', 'knowledge.read', 'knowledge.manage', 'approval.read', 'approval.decide', 'catalogue.manage', 'admin.roles', 'admin.settings', 'admin.environments', 'admin.connectors', 'device.approve'));
--> statement-breakpoint
-- Deliberately not it-analyst. The role that issues device commands must not be
-- the role that authorises a device to run something; that separation is the
-- whole reason this capability exists rather than reusing approval.decide.
INSERT INTO "role_capabilities" ("role_id", "capability") VALUES
	('platform-engineer', 'device.approve')
ON CONFLICT DO NOTHING;
