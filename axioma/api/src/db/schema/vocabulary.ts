import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { STATE_TYPES } from "@/shared";

export const ticketStatuses = pgTable(
	"ticket_statuses",
	{
		key: text("key").primaryKey(),
		label: text("label").notNull(),
		stateType: text("state_type", { enum: STATE_TYPES }).notNull(),
		isClosed: boolean("is_closed").notNull().default(false),
		pausesSla: boolean("pauses_sla").notNull().default(false),
		isDefault: boolean("is_default").notNull().default(false),
		// No colour column: a status's tone is derived from state_type by the
		// shared status-tone map, so storing a colour name per row offered a knob
		// that changed nothing. Dropped in 0047.
		displayOrder: integer("display_order").notNull().default(0),
		isActive: boolean("is_active").notNull().default(true),
	},
	(t) => [index("ticket_statuses_order_idx").on(t.isActive, t.displayOrder)],
);

export const ticketStatusTransitions = pgTable(
	"ticket_status_transitions",
	{
		fromStatus: text("from_status")
			.notNull()
			.references(() => ticketStatuses.key, { onDelete: "cascade" }),
		action: text("action").notNull(),
		toStatus: text("to_status")
			.notNull()
			.references(() => ticketStatuses.key, { onDelete: "cascade" }),
	},
	(t) => [
		uniqueIndex("ticket_status_transitions_lookup_idx").on(
			t.fromStatus,
			t.action,
		),
		index("ticket_status_transitions_to_status_idx").on(t.toStatus),
	],
);
