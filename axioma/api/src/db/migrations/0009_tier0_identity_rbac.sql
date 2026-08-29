ALTER TABLE "user" ADD COLUMN "kind" text DEFAULT 'reporter' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "manager_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_kind_check" CHECK ("kind" in ('staff', 'reporter'));--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_manager_not_self_check" CHECK ("manager_id" is null or "manager_id" <> "id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_manager_id_user_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."user"("id") ON DELETE set null;--> statement-breakpoint
CREATE INDEX "user_manager_idx" ON "user" USING btree ("manager_id");--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teams_name_unique" UNIQUE("name")
);--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id"),
	CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade,
	CONSTRAINT "team_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX "team_members_user_idx" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE TABLE "department_teams" (
	"department_id" text NOT NULL,
	"team_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "department_teams_department_id_team_id_pk" PRIMARY KEY("department_id","team_id"),
	CONSTRAINT "department_teams_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade,
	CONSTRAINT "department_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX "department_teams_team_uidx" ON "department_teams" USING btree ("team_id");--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);--> statement-breakpoint
CREATE TABLE "role_capabilities" (
	"role_id" text NOT NULL,
	"capability" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_capabilities_role_id_capability_pk" PRIMARY KEY("role_id","capability"),
	CONSTRAINT "role_capabilities_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade,
	CONSTRAINT "role_capabilities_key_check" CHECK ("capability" in ('ticket.read.own', 'ticket.read.all', 'ticket.create', 'ticket.resolve', 'ticket.close', 'ticket.escalate', 'ticket.reclassify', 'ticket.assign', 'ticket.reopen', 'run.start', 'run.cancel', 'run.read', 'device.read', 'device.enroll', 'device.command', 'stats.read', 'problem.manage', 'change.manage', 'change.approve', 'knowledge.read', 'knowledge.manage', 'approval.read', 'approval.decide', 'catalogue.manage', 'admin.roles', 'admin.settings'))
);--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id"),
	CONSTRAINT "user_roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade,
	CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE TABLE "team_roles" (
	"team_id" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_roles_team_id_role_id_pk" PRIMARY KEY("team_id","role_id"),
	CONSTRAINT "team_roles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade,
	CONSTRAINT "team_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX "team_roles_role_idx" ON "team_roles" USING btree ("role_id");--> statement-breakpoint
CREATE TABLE "role_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"role_id" text NOT NULL,
	"role_name" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"actor_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_grants_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict,
	CONSTRAINT "role_grants_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null,
	CONSTRAINT "role_grants_action_check" CHECK ("action" in ('grant', 'revoke')),
	CONSTRAINT "role_grants_target_type_check" CHECK ("target_type" in ('user', 'team', 'capability')),
	CONSTRAINT "role_grants_capability_check" CHECK ("target_type" <> 'capability' or "target_id" in ('ticket.read.own', 'ticket.read.all', 'ticket.create', 'ticket.resolve', 'ticket.close', 'ticket.escalate', 'ticket.reclassify', 'ticket.assign', 'ticket.reopen', 'run.start', 'run.cancel', 'run.read', 'device.read', 'device.enroll', 'device.command', 'stats.read', 'problem.manage', 'change.manage', 'change.approve', 'knowledge.read', 'knowledge.manage', 'approval.read', 'approval.decide', 'catalogue.manage', 'admin.roles', 'admin.settings'))
);--> statement-breakpoint
CREATE INDEX "role_grants_target_idx" ON "role_grants" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "role_grants_role_idx" ON "role_grants" USING btree ("role_id","created_at");--> statement-breakpoint
INSERT INTO "roles" ("id", "name", "description") VALUES
	('employee', 'Employee', 'Employee self-service access'),
	('it-analyst', 'IT Analyst', 'Ticket, run, device and reporting operations'),
	('platform-engineer', 'Platform Engineer', 'IT Analyst plus platform administration')
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "role_capabilities" ("role_id", "capability") VALUES
	('employee', 'ticket.create'),
	('employee', 'ticket.read.own'),
	('it-analyst', 'ticket.read.own'),
	('it-analyst', 'ticket.read.all'),
	('it-analyst', 'ticket.create'),
	('it-analyst', 'ticket.resolve'),
	('it-analyst', 'ticket.close'),
	('it-analyst', 'ticket.escalate'),
	('it-analyst', 'ticket.reclassify'),
	('it-analyst', 'ticket.assign'),
	('it-analyst', 'ticket.reopen'),
	('it-analyst', 'run.start'),
	('it-analyst', 'run.cancel'),
	('it-analyst', 'run.read'),
	('it-analyst', 'device.read'),
	('it-analyst', 'device.enroll'),
	('it-analyst', 'device.command'),
	('it-analyst', 'stats.read')
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "role_capabilities" ("role_id", "capability")
SELECT 'platform-engineer', "capability" FROM "role_capabilities" WHERE "role_id" = 'it-analyst'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "role_capabilities" ("role_id", "capability") VALUES
	('platform-engineer', 'admin.roles'),
	('platform-engineer', 'admin.settings')
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "user_roles" ("user_id", "role_id") SELECT "id", 'it-analyst' FROM "user" ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "role_grants" ("id", "action", "role_id", "role_name", "target_type", "target_id", "actor_id")
SELECT 'seed-it-analyst:' || "id", 'grant', 'it-analyst', 'IT Analyst', 'user', "id", NULL FROM "user"
ON CONFLICT ("id") DO NOTHING;
