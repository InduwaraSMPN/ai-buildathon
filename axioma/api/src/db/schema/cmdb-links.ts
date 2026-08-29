import {
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { cmdbObjects } from "./cmdb";
import { tickets } from "./tickets";

export const ticketCmdbObjects = pgTable(
	"ticket_cmdb_objects",
	{
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		objectId: text("object_id")
			.notNull()
			.references(() => cmdbObjects.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.ticketId, t.objectId] }),
		index("ticket_cmdb_objects_object_idx").on(t.objectId),
	],
);
