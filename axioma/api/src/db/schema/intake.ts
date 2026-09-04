import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { serviceSubcategories } from "./catalogue";
import { forms } from "./forms";
import { tickets } from "./tickets";

export const INTAKE_DRAFT_STATUSES = [
	"open",
	"submitted",
	"discarded",
] as const;
export const INTAKE_INTENTS = [
	"incident",
	"catalogue_request",
	"knowledge_answer",
] as const;

export const ticketDrafts = pgTable(
	"ticket_drafts",
	{
		id: text("id").primaryKey(),
		reporterId: text("reporter_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		status: text("status", { enum: INTAKE_DRAFT_STATUSES })
			.notNull()
			.default("open"),
		intent: text("intent", { enum: INTAKE_INTENTS }),
		transcript: jsonb("transcript").notNull().default([]),
		aiDraft: jsonb("ai_draft"),
		values: jsonb("values").notNull().default({}),
		fieldSources: jsonb("field_sources").notNull().default({}),
		subcategoryId: text("subcategory_id").references(
			() => serviceSubcategories.id,
			{ onDelete: "set null" },
		),
		formId: text("form_id").references(() => forms.id, {
			onDelete: "set null",
		}),
		ticketId: text("ticket_id").references(() => tickets.id, {
			onDelete: "set null",
		}),
		model: text("model"),
		promptTokens: integer("prompt_tokens"),
		completionTokens: integer("completion_tokens"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		index("ticket_drafts_reporter_status_idx").on(
			t.reporterId,
			t.status,
			t.updatedAt,
		),
		// The TTL sweep filters on status and age with no reporter, so the
		// reporter-leading index above cannot serve it.
		index("ticket_drafts_status_updated_idx").on(t.status, t.updatedAt),
	],
);
