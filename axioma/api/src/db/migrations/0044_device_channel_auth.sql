CREATE TABLE IF NOT EXISTS "device_enrolment_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" text,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"used_by_device_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_enrolment_tokens_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "device_enrolment_tokens_hash_uidx" ON "device_enrolment_tokens" USING btree ("token_hash");
--> statement-breakpoint
DROP INDEX IF EXISTS "devices_enrolment_code_uidx";
--> statement-breakpoint
ALTER TABLE "devices" DROP COLUMN IF EXISTS "enrolment_code";
--> statement-breakpoint
ALTER TABLE "devices" DROP COLUMN IF EXISTS "enrolment_code_expires_at";
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "credential_hash" text;
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "credential_rotated_at" timestamp;
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp;
