import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { devices } from "./devices";

export const assetDevices = pgTable(
	"asset_devices",
	{
		id: text("id").primaryKey(),
		assetId: text("asset_id")
			.notNull()
			.references(() => assets.id, { onDelete: "cascade" }),
		deviceId: text("device_id")
			.notNull()
			.references(() => devices.id, { onDelete: "cascade" }),
		lastReportedAt: timestamp("last_reported_at").notNull(),
	},
	(t) => [
		uniqueIndex("asset_devices_device_uidx").on(t.deviceId),
		index("asset_devices_asset_idx").on(t.assetId),
	],
);

export const assetDisks = pgTable(
	"asset_disks",
	{
		id: text("id").primaryKey(),
		assetDeviceId: text("asset_device_id")
			.notNull()
			.references(() => assetDevices.id, {
				onDelete: "cascade",
			}),
		deviceKey: text("device_key").notNull(),
		model: text("model"),
		serialNumber: text("serial_number"),
		sizeBytes: text("size_bytes"),
		raw: text("raw"),
		observedAt: timestamp("observed_at").notNull(),
	},
	(t) => [
		uniqueIndex("asset_disks_device_key_uidx").on(t.assetDeviceId, t.deviceKey),
	],
);

export const assetHardware = pgTable(
	"asset_hardware",
	{
		id: text("id").primaryKey(),
		assetDeviceId: text("asset_device_id")
			.notNull()
			.references(() => assetDevices.id, {
				onDelete: "cascade",
			}),
		manufacturer: text("manufacturer"),
		model: text("model"),
		serialNumber: text("serial_number"),
		cpu: text("cpu"),
		memoryBytes: text("memory_bytes"),
		biosVersion: text("bios_version"),
		raw: text("raw"),
		observedAt: timestamp("observed_at").notNull(),
	},
	(t) => [uniqueIndex("asset_hardware_device_uidx").on(t.assetDeviceId)],
);

export const softwareInventoryApps = pgTable(
	"software_inventory_apps",
	{
		id: text("id").primaryKey(),
		assetDeviceId: text("asset_device_id")
			.notNull()
			.references(() => assetDevices.id, {
				onDelete: "cascade",
			}),
		identityKey: text("identity_key").notNull(),
		name: text("name").notNull(),
		version: text("version"),
		publisher: text("publisher"),
		installDate: text("install_date"),
		raw: text("raw"),
		observedAt: timestamp("observed_at").notNull(),
	},
	(t) => [
		uniqueIndex("software_inventory_identity_uidx").on(
			t.assetDeviceId,
			t.identityKey,
		),
		index("software_inventory_name_idx").on(t.name),
	],
);

export const inventoryReports = pgTable(
	"inventory_reports",
	{
		id: text("id").primaryKey(),
		assetDeviceId: text("asset_device_id")
			.notNull()
			.references(() => assetDevices.id, {
				onDelete: "cascade",
			}),
		payload: jsonb("payload").notNull(),
		reportedAt: timestamp("reported_at").notNull(),
	},
	(t) => [
		index("inventory_reports_device_idx").on(t.assetDeviceId, t.reportedAt),
	],
);
