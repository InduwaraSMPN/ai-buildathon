import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { ENVIRONMENT_CONNECTION_TYPES } from "@/shared";
import { services } from "./catalogue";
import { tickets } from "./tickets";

export {
	ENVIRONMENT_CONNECTION_TYPES,
	type EnvironmentConnectionType,
} from "@/shared";

export const ENVIRONMENT_MODES = ["act", "shadow"] as const;
export type EnvironmentMode = (typeof ENVIRONMENT_MODES)[number];

export const ENVIRONMENT_SOURCES = ["ticket", "cmdb", "default"] as const;
export type EnvironmentSource = (typeof ENVIRONMENT_SOURCES)[number];

/**
 * A Kubernetes cluster reachable by the platform.
 *
 * `credentialEncrypted` holds a kubeconfig or token, AES-256-GCM encrypted using
 * the same scheme as auth provider secrets (`v1:iv:ciphertext:tag`). It is never
 * returned by any API surface. `isDefault` has a partial unique index so at most
 * one row is the fallback when a ticket has neither a structured environment
 * linkage nor a CMDB-backed one.
 */
export const environments = pgTable(
	"environments",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		label: text("label").notNull(),
		connectionType: text("connection_type", {
			enum: ENVIRONMENT_CONNECTION_TYPES,
		}).notNull(),
		contextName: text("context_name"),
		credentialEncrypted: text("credential_encrypted"),
		mode: text("mode", { enum: ENVIRONMENT_MODES }).notNull().default("act"),
		isDefault: boolean("is_default").notNull().default(false),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("environments_key_uidx").on(t.key),
		uniqueIndex("environments_default_uidx")
			.on(t.isDefault)
			.where(sql`${t.isDefault} = true`),
	],
);

/** Which environments a given service may run in. */
export const serviceEnvironments = pgTable(
	"service_environments",
	{
		serviceId: text("service_id")
			.notNull()
			.references(() => services.id, { onDelete: "restrict" }),
		environmentId: text("environment_id")
			.notNull()
			.references(() => environments.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.serviceId, t.environmentId] }),
		index("service_environments_environment_idx").on(t.environmentId),
	],
);

/** Structured, validated ticket→environment linkage. One structured target per ticket (ticketId is PK). */
export const ticketEnvironments = pgTable(
	"ticket_environments",
	{
		ticketId: text("ticket_id")
			.primaryKey()
			.references(() => tickets.id, { onDelete: "cascade" }),
		environmentId: text("environment_id")
			.notNull()
			.references(() => environments.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [index("ticket_environments_environment_idx").on(t.environmentId)],
);
