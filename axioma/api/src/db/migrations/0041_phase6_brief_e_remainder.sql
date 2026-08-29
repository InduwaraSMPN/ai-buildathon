DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "sso_identities")
		OR EXISTS (SELECT 1 FROM "status_incident_updates")
		OR EXISTS (SELECT 1 FROM "asset_types")
		OR EXISTS (SELECT 1 FROM "asset_locations")
		OR EXISTS (SELECT 1 FROM "contract_terms")
		OR EXISTS (SELECT 1 FROM "payment_schedules")
		OR EXISTS (SELECT 1 FROM "assets" WHERE "type_id" IS NOT NULL OR "location_id" IS NOT NULL)
	THEN
		RAISE EXCEPTION '0037 refuses to drop populated schema-only tables or asset references';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "asset_import_profiles" ADD COLUMN "dynamic_field_columns" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
COMMENT ON COLUMN "assets"."attributes" IS 'Normalized full source rows retained as import provenance; declared profile columns are also stored through dynamic fields.';--> statement-breakpoint
COMMENT ON COLUMN "asset_import_profiles"."dynamic_field_columns" IS 'CSV header to active asset dynamic-field key mapping.';--> statement-breakpoint
DROP TABLE IF EXISTS "sso_identities";--> statement-breakpoint
DROP TABLE IF EXISTS "status_incident_updates";--> statement-breakpoint
DROP TABLE IF EXISTS "contract_terms";--> statement-breakpoint
DROP TABLE IF EXISTS "payment_schedules";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN IF EXISTS "type_id";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN IF EXISTS "location_id";--> statement-breakpoint
DROP TABLE IF EXISTS "asset_types";--> statement-breakpoint
DROP TABLE IF EXISTS "asset_locations";
