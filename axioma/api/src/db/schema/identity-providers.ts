import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const authProviders = pgTable(
	"auth_providers",
	{
		id: text("id").primaryKey(),
		providerId: text("provider_id").notNull(),
		name: text("name").notNull(),
		discoveryUrl: text("discovery_url").notNull(),
		clientId: text("client_id").notNull(),
		clientSecretEncrypted: text("client_secret_encrypted").notNull(),
		scopes: text("scopes")
			.array()
			.notNull()
			.default(["openid", "profile", "email"]),
		enabled: boolean("enabled").notNull().default(false),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("auth_providers_provider_id_uidx").on(t.providerId),
		check(
			"auth_providers_provider_id_check",
			sql`${t.providerId} ~ '^[a-z0-9][a-z0-9_-]*$'`,
		),
	],
);

// sso_identities duplicated Better Auth account linkage and was never populated; 0037 drops it.

export const directoryIdentities = pgTable(
	"directory_identities",
	{
		id: text("id").primaryKey(),
		providerId: text("provider_id")
			.notNull()
			.references(() => authProviders.id, { onDelete: "restrict" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		externalId: text("external_id").notNull(),
		department: text("department"),
		leaver: boolean("leaver").notNull().default(false),
		lastSeenAt: timestamp("last_seen_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("directory_identities_provider_external_uidx").on(
			t.providerId,
			t.externalId,
		),
		uniqueIndex("directory_identities_provider_user_uidx").on(
			t.providerId,
			t.userId,
		),
		index("directory_identities_leaver_idx").on(t.providerId, t.leaver),
		index("directory_identities_user_id_idx").on(t.userId),
	],
);

export const directorySyncRuns = pgTable(
	"directory_sync_runs",
	{
		id: text("id").primaryKey(),
		providerId: text("provider_id")
			.notNull()
			.references(() => authProviders.id, { onDelete: "restrict" }),
		mode: text("mode", { enum: ["preview", "apply"] }).notNull(),
		status: text("status", {
			enum: ["completed", "rejected", "failed"],
		}).notNull(),
		previousCount: integer("previous_count").notNull(),
		foundCount: integer("found_count").notNull(),
		createdCount: integer("created_count").notNull(),
		updatedCount: integer("updated_count").notNull(),
		leaverCount: integer("leaver_count").notNull(),
		summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("directory_sync_runs_provider_created_idx").on(
			t.providerId,
			t.createdAt,
		),
	],
);
