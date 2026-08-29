import { sql } from "drizzle-orm";
import {
	check,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/** A named query owned by one user or team. Team ids are intentionally opaque. */
export const savedViews = pgTable(
	"saved_views",
	{
		id: text("id").primaryKey(),
		ownerType: text("owner_type", { enum: ["user", "team"] }).notNull(),
		ownerId: text("owner_id").notNull(),
		createdById: text("created_by_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		objectType: text("object_type"),
		filters: jsonb("filters").notNull(),
		sort: jsonb("sort"),
		columns: text("columns").array(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		check(
			"saved_views_user_owner_check",
			sql`${t.ownerType} <> 'user' OR ${t.ownerId} = ${t.createdById}`,
		),
		uniqueIndex("saved_views_owner_name_uidx").on(
			t.ownerType,
			t.ownerId,
			t.name,
		),
		index("saved_views_creator_idx").on(t.createdById),
	],
);
