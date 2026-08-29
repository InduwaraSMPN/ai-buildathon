import { sql } from "drizzle-orm";
import {
	check,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { apiKeys } from "./api-keys";

export const apiRateLimits = pgTable(
	"api_rate_limits",
	{
		scope: text("scope").primaryKey(),
		requestLimit: integer("request_limit").notNull(),
		perKeyLimit: integer("per_key_limit").notNull(),
		windowSeconds: integer("window_seconds").notNull(),
		windowStartedAt: timestamp("window_started_at", { withTimezone: true }),
		requestCount: integer("request_count").default(0).notNull(),
	},
	(t) => [
		check("api_rate_limits_scope_check", sql`${t.scope} = 'global'`),
		check(
			"api_rate_limits_values_check",
			sql`${t.requestLimit} > 0 and ${t.perKeyLimit} > 0 and ${t.windowSeconds} > 0 and ${t.requestCount} >= 0`,
		),
	],
);

export const apiKeyRateLimits = pgTable(
	"api_key_rate_limits",
	{
		apiKeyId: text("api_key_id")
			.notNull()
			.references(() => apiKeys.id, { onDelete: "cascade" }),
		windowStartedAt: timestamp("window_started_at", {
			withTimezone: true,
		}).notNull(),
		requestCount: integer("request_count").default(0).notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.apiKeyId, t.windowStartedAt] }),
		check("api_key_rate_limits_count_check", sql`${t.requestCount} >= 0`),
	],
);
