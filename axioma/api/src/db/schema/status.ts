import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const STATUS_INCIDENT_STATES = [
	"investigating",
	"identified",
	"monitoring",
	"resolved",
] as const;

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
	],
);

export const statusIncidentUpdates = pgTable(
	"status_incident_updates",
	{
		id: text("id").primaryKey(),
		incidentId: text("incident_id")
			.notNull()
			.references(() => statusIncidents.id, { onDelete: "cascade" }),
		state: text("state", { enum: STATUS_INCIDENT_STATES }).notNull(),
		message: text("message").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("status_incident_updates_incident_idx").on(t.incidentId, t.createdAt),
	],
);
