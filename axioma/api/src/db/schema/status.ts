import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const serviceImpactLevels = pgTable("service_impact_levels", {
	key: text("key").primaryKey(),
	label: text("label").notNull(),
	countsAsDowntime: boolean("counts_as_downtime").notNull().default(true),
});

export const statusServices = pgTable("status_services", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	active: boolean("active").notNull().default(true),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const statusIncidents = pgTable(
	"status_incidents",
	{
		id: text("id").primaryKey(),
		serviceId: text("service_id")
			.notNull()
			.references(() => statusServices.id, { onDelete: "cascade" }),
		impactLevel: text("impact_level")
			.notNull()
			.references(() => serviceImpactLevels.key),
		title: text("title").notNull(),
		plannedMaintenance: boolean("planned_maintenance").notNull().default(false),
		startedAt: timestamp("started_at").notNull(),
		resolvedAt: timestamp("resolved_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("status_incidents_service_time_idx").on(t.serviceId, t.startedAt),
		index("status_incidents_impact_level_idx").on(t.impactLevel),
	],
);

// status_incident_updates had no read/write path; 0037 drops it until an incident timeline is implemented.
