CREATE TABLE IF NOT EXISTS "asset_types" (
  "id" text PRIMARY KEY, "name" text NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "asset_types_name_uidx" ON "asset_types" ("name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_locations" (
  "id" text PRIMARY KEY, "name" text NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "asset_locations_name_uidx" ON "asset_locations" ("name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_statuses" (
  "id" text PRIMARY KEY, "name" text NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "asset_statuses_name_uidx" ON "asset_statuses" ("name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
  "id" text PRIMARY KEY, "name" text NOT NULL, "asset_tag" text, "serial_number" text,
  "type_id" text REFERENCES "asset_types"("id") ON DELETE set null,
  "location_id" text REFERENCES "asset_locations"("id") ON DELETE set null,
  "status_id" text REFERENCES "asset_statuses"("id") ON DELETE set null,
  "custodian_id" text REFERENCES "user"("id") ON DELETE set null,
  "attributes" jsonb, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "assets_tag_uidx" ON "assets" ("asset_tag");
CREATE INDEX IF NOT EXISTS "assets_serial_idx" ON "assets" ("serial_number");
CREATE INDEX IF NOT EXISTS "assets_type_idx" ON "assets" ("type_id");
CREATE INDEX IF NOT EXISTS "assets_location_idx" ON "assets" ("location_id");
CREATE INDEX IF NOT EXISTS "assets_status_idx" ON "assets" ("status_id");
CREATE INDEX IF NOT EXISTS "assets_custodian_idx" ON "assets" ("custodian_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_devices" (
  "id" text PRIMARY KEY, "asset_id" text NOT NULL REFERENCES "assets"("id") ON DELETE cascade,
  "device_id" text NOT NULL REFERENCES "devices"("id") ON DELETE cascade, "last_reported_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_devices_device_uidx" ON "asset_devices" ("device_id");
CREATE INDEX IF NOT EXISTS "asset_devices_asset_idx" ON "asset_devices" ("asset_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_disks" (
  "id" text PRIMARY KEY, "asset_device_id" text NOT NULL REFERENCES "asset_devices"("id") ON DELETE cascade,
  "device_key" text NOT NULL, "model" text, "serial_number" text, "size_bytes" text, "raw" text, "observed_at" timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "asset_disks_device_key_uidx" ON "asset_disks" ("asset_device_id", "device_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_hardware" (
  "id" text PRIMARY KEY, "asset_device_id" text NOT NULL REFERENCES "asset_devices"("id") ON DELETE cascade,
  "manufacturer" text, "model" text, "serial_number" text, "cpu" text, "memory_bytes" text, "bios_version" text,
  "raw" text, "observed_at" timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "asset_hardware_device_uidx" ON "asset_hardware" ("asset_device_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "software_inventory_apps" (
  "id" text PRIMARY KEY, "asset_device_id" text NOT NULL REFERENCES "asset_devices"("id") ON DELETE cascade,
  "identity_key" text NOT NULL, "name" text NOT NULL, "version" text, "publisher" text, "install_date" text,
  "raw" text, "observed_at" timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "software_inventory_identity_uidx" ON "software_inventory_apps" ("asset_device_id", "identity_key");
CREATE INDEX IF NOT EXISTS "software_inventory_name_idx" ON "software_inventory_apps" ("name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_reports" (
  "id" text PRIMARY KEY, "asset_device_id" text NOT NULL REFERENCES "asset_devices"("id") ON DELETE cascade,
  "payload" jsonb NOT NULL, "reported_at" timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS "inventory_reports_device_idx" ON "inventory_reports" ("asset_device_id", "reported_at");
