import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { agentRuns, agentSteps } from "./agent";
import { environments } from "./environments";
import { tickets } from "./tickets";

export const cmdbClasses = pgTable(
	"cmdb_classes",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		label: text("label").notNull(),
		parentClassId: text("parent_class_id").references(
			(): AnyPgColumn => cmdbClasses.id,
			{ onDelete: "set null" },
		),
	},
	(t) => [
		uniqueIndex("cmdb_classes_key_uidx").on(t.key),
		index("cmdb_classes_parent_class_id_idx").on(t.parentClassId),
	],
);

export const cmdbClassProperties = pgTable(
	"cmdb_class_properties",
	{
		id: text("id").primaryKey(),
		classId: text("class_id")
			.notNull()
			.references(() => cmdbClasses.id, { onDelete: "cascade" }),
		propertyKey: text("property_key").notNull(),
		label: text("label").notNull(),
		propertyType: text("property_type").notNull(),
		targetClassId: text("target_class_id").references(() => cmdbClasses.id, {
			onDelete: "restrict",
		}),
		isRequired: boolean("is_required").notNull().default(false),
		spreadsImpact: boolean("spreads_impact").notNull().default(false),
	},
	(t) => [
		uniqueIndex("cmdb_class_properties_key_uidx").on(t.classId, t.propertyKey),
		index("cmdb_class_properties_target_idx").on(t.targetClassId),
	],
);

/** Additive CI observations. The four provenance columns remain exactly named and typed. */
export const cmdbObjects = pgTable(
	"cmdb_objects",
	{
		id: text("id").primaryKey(),
		classId: text("class_id")
			.notNull()
			.references(() => cmdbClasses.id, { onDelete: "restrict" }),
		externalId: text("external_id").notNull(),
		name: text("name").notNull(),

		// provenance
		sourceTicketId: text("source_ticket_id").references(() => tickets.id, {
			onDelete: "set null",
		}),
		sourceRunId: text("source_run_id").references(() => agentRuns.id, {
			onDelete: "set null",
		}),
		sourceStepId: text("source_step_id").references(() => agentSteps.id, {
			onDelete: "set null",
		}),
		observedAt: timestamp("observed_at").defaultNow().notNull(),
	},
	(t) => [
		index("cmdb_objects_lookup_idx").on(t.classId, t.externalId, t.observedAt),
		index("cmdb_objects_source_idx").on(t.sourceTicketId),
		index("cmdb_objects_run_idx").on(t.sourceRunId),
		index("cmdb_objects_step_idx").on(t.sourceStepId),
	],
);

export const cmdbObjectProperties = pgTable(
	"cmdb_object_properties",
	{
		id: text("id").primaryKey(),
		objectId: text("object_id")
			.notNull()
			.references(() => cmdbObjects.id, { onDelete: "cascade" }),
		propertyId: text("property_id")
			.notNull()
			.references(() => cmdbClassProperties.id, { onDelete: "restrict" }),
		value: jsonb("value").notNull(),
	},
	(t) => [
		uniqueIndex("cmdb_object_properties_uidx").on(t.objectId, t.propertyId),
		index("cmdb_object_properties_property_id_idx").on(t.propertyId),
	],
);

/**
 * CMDB object→environment linkage. Unique object link: one environment per CI, so
 * the ticket→CMDB→default resolution step is deterministic.
 */
export const cmdbObjectEnvironments = pgTable(
	"cmdb_object_environments",
	{
		objectId: text("object_id")
			.notNull()
			.references(() => cmdbObjects.id, { onDelete: "cascade" }),
		environmentId: text("environment_id")
			.notNull()
			.references(() => environments.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("cmdb_object_environments_object_uidx").on(t.objectId),
		index("cmdb_object_environments_environment_idx").on(t.environmentId),
	],
);

export const cmdbRelationshipTypes = pgTable(
	"cmdb_relationship_types",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		verb: text("verb").notNull(),
		inverseVerb: text("inverse_verb").notNull(),
		impactDirection: text("impact_direction", {
			enum: ["forward", "reverse", "both", "none"],
		})
			.notNull()
			.default("none"),
	},
	(t) => [uniqueIndex("cmdb_relationship_types_key_uidx").on(t.key)],
);

export const cmdbObjectRelationships = pgTable(
	"cmdb_object_relationships",
	{
		id: text("id").primaryKey(),
		typeId: text("type_id")
			.notNull()
			.references(() => cmdbRelationshipTypes.id, { onDelete: "restrict" }),
		sourceObjectId: text("source_object_id")
			.notNull()
			.references(() => cmdbObjects.id, { onDelete: "cascade" }),
		targetObjectId: text("target_object_id")
			.notNull()
			.references(() => cmdbObjects.id, { onDelete: "cascade" }),
		propertyId: text("property_id").references(() => cmdbClassProperties.id, {
			onDelete: "restrict",
		}),
	},
	(t) => [
		index("cmdb_object_relationships_source_idx").on(t.sourceObjectId),
		index("cmdb_object_relationships_target_idx").on(t.targetObjectId),
		index("cmdb_object_relationships_property_id_idx").on(t.propertyId),
		index("cmdb_object_relationships_type_id_idx").on(t.typeId),
	],
);

export const CMDB_SEED_CLASSES = [
	"FunctionalCI",
	"Server",
	"PC",
	"NetworkDevice",
	"ApplicationSolution",
	"BusinessProcess",
	"Software",
	"SoftwareInstance",
	"Subnet",
] as const;

export const LEGACY_CMDB_CLASS_KEYS = {
	service: "ApplicationSolution",
	deployment: "SoftwareInstance",
	pod: "SoftwareInstance",
	device: "PC",
	dependency: "FunctionalCI",
} as const;
