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

import { user } from "./auth";
import { tickets } from "./tickets";

export const forms = pgTable(
	"forms",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		version: integer("version").notNull(),
		name: text("name").notNull(),
		description: text("description"),
		// draft -> published -> archived
		status: text("status", { enum: ["draft", "published", "archived"] })
			.notNull()
			.default("draft"),
		createdById: text("created_by_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		publishedAt: timestamp("published_at"),
	},
	(t) => [
		check("forms_version_positive", sql`${t.version} > 0`),
		uniqueIndex("forms_key_version_uidx").on(t.key, t.version),
		index("forms_status_idx").on(t.status),
	],
);

export const formFields = pgTable(
	"form_fields",
	{
		id: text("id").primaryKey(),
		formId: text("form_id")
			.notNull()
			.references(() => forms.id, { onDelete: "cascade" }),
		key: text("key").notNull(),
		label: text("label").notNull(),
		description: text("description"),
		type: text("type", {
			enum: [
				"text",
				"textarea",
				"number",
				"boolean",
				"date",
				"select",
				"multiselect",
			],
		}).notNull(),
		ordinal: integer("ordinal").notNull(),
		options: jsonb("options"),
		validation: jsonb("validation"),
		// Declarative expression evaluated by the form renderer/server validator.
		condition: jsonb("condition"),
		isMandatory: boolean("is_mandatory").notNull().default(false),
		isHidden: boolean("is_hidden").notNull().default(false),
		isReadonly: boolean("is_readonly").notNull().default(false),
		predefinedValue: jsonb("predefined_value"),
	},
	(t) => [
		check("form_fields_ordinal_nonnegative", sql`${t.ordinal} >= 0`),
		uniqueIndex("form_fields_form_key_uidx").on(t.formId, t.key),
		uniqueIndex("form_fields_form_ordinal_uidx").on(t.formId, t.ordinal),
	],
);

export const formSubmissions = pgTable(
	"form_submissions",
	{
		id: text("id").primaryKey(),
		formId: text("form_id")
			.notNull()
			.references(() => forms.id, { onDelete: "restrict" }),
		submitterId: text("submitter_id").references(() => user.id, {
			onDelete: "set null",
		}),
		ticketId: text("ticket_id").references(() => tickets.id, {
			onDelete: "set null",
		}),
		values: jsonb("values").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("form_submissions_form_idx").on(t.formId, t.createdAt),
		index("form_submissions_submitter_idx").on(t.submitterId),
		index("form_submissions_ticket_idx").on(t.ticketId, t.createdAt),
	],
);
