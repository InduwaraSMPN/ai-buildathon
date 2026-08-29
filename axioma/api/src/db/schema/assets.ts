import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// asset_types and asset_locations were empty schema-only extension points; 0037 drops them and their unused asset columns.

export const assetStatuses = pgTable(
	"asset_statuses",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("asset_statuses_name_uidx").on(t.name)],
);

export const assets = pgTable(
	"assets",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		assetTag: text("asset_tag"),
		serialNumber: text("serial_number"),
		statusId: text("status_id").references(() => assetStatuses.id, {
			onDelete: "set null",
		}),
		custodianId: text("custodian_id").references(() => user.id, {
			onDelete: "set null",
		}),
		// Normalized full CSV rows retained as import provenance; declared values also live in dynamic fields.
		attributes: jsonb("attributes"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("assets_tag_uidx").on(t.assetTag),
		index("assets_serial_idx").on(t.serialNumber),
		index("assets_status_idx").on(t.statusId),
		index("assets_custodian_idx").on(t.custodianId),
	],
);

export const assetCheckoutLog = pgTable(
	"asset_checkout_log",
	{
		id: text("id").primaryKey(),
		assetId: text("asset_id")
			.notNull()
			.references(() => assets.id, { onDelete: "cascade" }),
		custodianId: text("custodian_id").references(() => user.id, {
			onDelete: "set null",
		}),
		checkedOutAt: timestamp("checked_out_at").notNull(),
		checkedInAt: timestamp("checked_in_at"),
		note: text("note"),
	},
	(t) => [
		index("asset_checkout_asset_idx").on(t.assetId, t.checkedOutAt),
		index("asset_checkout_log_custodian_id_idx").on(t.custodianId),
	],
);

export const assetHistory = pgTable(
	"asset_history",
	{
		id: text("id").primaryKey(),
		assetId: text("asset_id")
			.notNull()
			.references(() => assets.id, { onDelete: "cascade" }),
		action: text("action").notNull(),
		actorId: text("actor_id").references(() => user.id, {
			onDelete: "set null",
		}),
		changes: jsonb("changes").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("asset_history_asset_idx").on(t.assetId, t.createdAt),
		index("asset_history_actor_id_idx").on(t.actorId),
	],
);

export const assetImportProfiles = pgTable(
	"asset_import_profiles",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		identityColumns: text("identity_columns").array().notNull(),
		dynamicFieldColumns: jsonb("dynamic_field_columns")
			.$type<Record<string, string>>()
			.notNull()
			.default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("asset_import_profiles_name_uidx").on(t.name)],
);

export const assetImportRuns = pgTable(
	"asset_import_runs",
	{
		id: text("id").primaryKey(),
		profileId: text("profile_id").references(() => assetImportProfiles.id, {
			onDelete: "set null",
		}),
		fileName: text("file_name"),
		totalRows: integer("total_rows").notNull(),
		acceptedRows: integer("accepted_rows").notNull(),
		rejectedRows: integer("rejected_rows").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [index("asset_import_runs_profile_idx").on(t.profileId, t.createdAt)],
);

export const assetImportIdentities = pgTable(
	"asset_import_identities",
	{
		id: text("id").primaryKey(),
		profileId: text("profile_id")
			.notNull()
			.references(() => assetImportProfiles.id, {
				onDelete: "cascade",
			}),
		identityKey: text("identity_key").notNull(),
		assetId: text("asset_id")
			.notNull()
			.references(() => assets.id, { onDelete: "cascade" }),
	},
	(t) => [
		uniqueIndex("asset_import_identity_uidx").on(t.profileId, t.identityKey),
		index("asset_import_identity_asset_idx").on(t.assetId),
	],
);

export const assetImportRejections = pgTable(
	"asset_import_rejections",
	{
		id: text("id").primaryKey(),
		runId: text("run_id")
			.notNull()
			.references(() => assetImportRuns.id, { onDelete: "cascade" }),
		rowNumber: integer("row_number").notNull(),
		reason: text("reason").notNull(),
		row: jsonb("row").notNull(),
	},
	(t) => [index("asset_import_rejections_run_idx").on(t.runId, t.rowNumber)],
);
