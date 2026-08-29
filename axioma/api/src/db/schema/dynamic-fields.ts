import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const DYNAMIC_FIELD_TYPES = [
	"text",
	"textarea",
	"integer",
	"date",
	"datetime",
	"dropdown",
	"multiselect",
	"checkbox",
	"reference",
] as const;

export type DynamicFieldType = (typeof DYNAMIC_FIELD_TYPES)[number];
export type DynamicFieldConfig = {
	maxLength?: number;
	min?: number;
	max?: number;
	options?: string[];
	referenceType?: string;
};

export const dynamicFields = pgTable(
	"dynamic_fields",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		label: text("label").notNull(),
		fieldType: text("field_type", { enum: DYNAMIC_FIELD_TYPES }).notNull(),
		objectType: text("object_type").notNull(),
		config: jsonb("config").$type<DynamicFieldConfig>().notNull().default({}),
		displayOrder: integer("display_order").notNull().default(0),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("dynamic_fields_object_key_uidx").on(t.objectType, t.key),
		index("dynamic_fields_active_idx").on(
			t.objectType,
			t.isActive,
			t.displayOrder,
		),
		check("dynamic_fields_key_not_blank", sql`length(trim(${t.key})) > 0`),
		check("dynamic_fields_label_not_blank", sql`length(trim(${t.label})) > 0`),
		check(
			"dynamic_fields_object_type_not_blank",
			sql`length(trim(${t.objectType})) > 0`,
		),
	],
);

export const dynamicFieldValues = pgTable(
	"dynamic_field_values",
	{
		fieldId: text("field_id")
			.notNull()
			.references(() => dynamicFields.id, { onDelete: "restrict" }),
		objectId: text("object_id").notNull(),
		value: jsonb("value").$type<unknown>().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("dynamic_field_values_field_object_uidx").on(
			t.fieldId,
			t.objectId,
		),
		index("dynamic_field_values_object_idx").on(t.objectId),
		check(
			"dynamic_field_values_object_not_blank",
			sql`length(trim(${t.objectId})) > 0`,
		),
	],
);
