CREATE TABLE "environments" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"connection_type" text NOT NULL,
	"context_name" text,
	"credential_encrypted" text,
	"mode" text DEFAULT 'act' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "environments_key_uidx" ON "environments" USING btree ("key");
--> statement-breakpoint
CREATE UNIQUE INDEX "environments_default_uidx" ON "environments" USING btree ("is_default") WHERE "environments"."is_default" = true;
--> statement-breakpoint
CREATE TABLE "service_environments" (
	"service_id" text NOT NULL,
	"environment_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_environments_service_id_environment_id_pk" PRIMARY KEY("service_id","environment_id"),
	CONSTRAINT "service_environments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "service_environments_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "service_environments_environment_idx" ON "service_environments" USING btree ("environment_id");
--> statement-breakpoint
CREATE TABLE "ticket_environments" (
	"ticket_id" text PRIMARY KEY NOT NULL,
	"environment_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_environments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "ticket_environments_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "ticket_environments_environment_idx" ON "ticket_environments" USING btree ("environment_id");
--> statement-breakpoint
CREATE TABLE "cmdb_object_environments" (
	"object_id" text NOT NULL,
	"environment_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cmdb_object_environments_object_id_cmdb_objects_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."cmdb_objects"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "cmdb_object_environments_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cmdb_object_environments_object_uidx" ON "cmdb_object_environments" USING btree ("object_id");
--> statement-breakpoint
CREATE INDEX "cmdb_object_environments_environment_idx" ON "cmdb_object_environments" USING btree ("environment_id");
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "environment_id" text;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "environment_key" text;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "environment_source" text;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "role_capabilities" DROP CONSTRAINT "role_capabilities_key_check";
--> statement-breakpoint
ALTER TABLE "role_capabilities" ADD CONSTRAINT "role_capabilities_key_check" CHECK ("capability" in ('ticket.read.own', 'ticket.read.all', 'ticket.create', 'ticket.update', 'ticket.resolve', 'ticket.close', 'ticket.escalate', 'ticket.reclassify', 'ticket.assign', 'ticket.reopen', 'run.start', 'run.cancel', 'run.read', 'device.read', 'device.enroll', 'device.command', 'stats.read', 'problem.manage', 'change.manage', 'change.approve', 'knowledge.read', 'knowledge.manage', 'approval.read', 'approval.decide', 'catalogue.manage', 'admin.roles', 'admin.settings', 'admin.environments', 'admin.connectors'));
--> statement-breakpoint
ALTER TABLE "role_grants" DROP CONSTRAINT "role_grants_capability_check";
--> statement-breakpoint
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_capability_check" CHECK ("target_type" <> 'capability' or "target_id" in ('ticket.read.own', 'ticket.read.all', 'ticket.create', 'ticket.update', 'ticket.resolve', 'ticket.close', 'ticket.escalate', 'ticket.reclassify', 'ticket.assign', 'ticket.reopen', 'run.start', 'run.cancel', 'run.read', 'device.read', 'device.enroll', 'device.command', 'stats.read', 'problem.manage', 'change.manage', 'change.approve', 'knowledge.read', 'knowledge.manage', 'approval.read', 'approval.decide', 'catalogue.manage', 'admin.roles', 'admin.settings', 'admin.environments', 'admin.connectors'));
