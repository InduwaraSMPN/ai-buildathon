import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { Capability } from "@/shared";
import { user } from "./auth";

export const apiKeys = pgTable(
	"api_keys",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		prefix: text("prefix").notNull().unique(),
		secretHash: text("secret_hash").notNull(),
		capabilities: jsonb("capabilities").$type<Capability[]>().notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		lastUsedAt: timestamp("last_used_at"),
		revokedAt: timestamp("revoked_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("api_keys_user_idx").on(t.userId),
		index("api_keys_expires_idx").on(t.expiresAt),
	],
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
