import { sql } from "drizzle-orm";
import {
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

/** One row per analyst/widget keeps arrangements independently persistent. */
export const dashboardWidgets = pgTable(
	"dashboard_widgets",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		widgetKey: text("widget_key").notNull(),
		position: integer("position").notNull(),
		width: integer("width").notNull().default(1),
		settings: jsonb("settings"),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("dashboard_widgets_user_key_uidx").on(t.userId, t.widgetKey),
		uniqueIndex("dashboard_widgets_user_position_uidx").on(
			t.userId,
			t.position,
		),
		index("dashboard_widgets_user_idx").on(t.userId, t.position),
		check("dashboard_widgets_position_nonnegative", sql`${t.position} >= 0`),
		check("dashboard_widgets_width_check", sql`${t.width} between 1 and 2`),
	],
);
