ALTER TABLE "devices" ALTER COLUMN "enrolled_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "devices" ALTER COLUMN "enrolled_at" DROP NOT NULL;--> statement-breakpoint
UPDATE "devices" SET "enrolled_at" = NULL WHERE "owner_id" IS NULL;