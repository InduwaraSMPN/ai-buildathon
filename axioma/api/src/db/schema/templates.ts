import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const EMAIL_TEMPLATE_RULE_SCOPES = [
	"catch_all",
	"domain",
	"address",
] as const;

export const emailTemplates = pgTable("email_templates", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	subject: text("subject").notNull(),
	textBody: text("text_body").notNull(),
	htmlBody: text("html_body"),
	enabled: boolean("enabled").notNull().default(true),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

/** scope determines precedence: exact address > domain > catch-all; row order is irrelevant. */
export const emailTemplateRules = pgTable(
	"email_template_rules",
	{
		id: text("id").primaryKey(),
		templateId: text("template_id")
			.notNull()
			.references(() => emailTemplates.id, { onDelete: "cascade" }),
		scope: text("scope", { enum: EMAIL_TEMPLATE_RULE_SCOPES }).notNull(),
		matchValue: text("match_value"),
		enabled: boolean("enabled").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("email_template_rules_template_id_idx").on(t.templateId),
		index("email_template_rules_lookup_idx").on(
			t.enabled,
			t.scope,
			t.matchValue,
		),
		check(
			"email_template_rules_match_shape",
			sql`(${t.scope} = 'catch_all' AND ${t.matchValue} IS NULL) OR (${t.scope} <> 'catch_all' AND ${t.matchValue} IS NOT NULL)`,
		),
	],
);
