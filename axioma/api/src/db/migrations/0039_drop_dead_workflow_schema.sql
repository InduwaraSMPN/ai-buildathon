ALTER TABLE "webhook_deliveries" DROP CONSTRAINT IF EXISTS "webhook_deliveries_message_format_id_webhook_message_formats_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "webhook_deliveries_message_format_id_idx";--> statement-breakpoint
ALTER TABLE "webhook_deliveries" DROP COLUMN IF EXISTS "message_format_id";--> statement-breakpoint
DROP TABLE IF EXISTS "webhook_message_formats";--> statement-breakpoint
DROP TABLE IF EXISTS "workflow_scheduled_emissions";
