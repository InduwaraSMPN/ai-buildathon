import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { agentRuns, agentSteps } from "./agent";
import { tickets } from "./tickets";

/**
 * Observed entities and relationships.
 *
 * Rows are additive observations, never overwrites. Two rows about the same
 * entity at different times are both true — of their own moment — and the
 * newest one wins on read.
 *
 * The four provenance columns are the point of this table. Recording which
 * ticket, run, and step produced a fact costs almost nothing now and is the only
 * part of a governed CMDB that is genuinely expensive to add later. Everything
 * else a governed version needs — proposals, separate ownership, approval before
 * correction, rollback — can be built on top of provenance whenever it is wanted.
 */
export const cmdbItems = pgTable(
	"cmdb_items",
	{
		id: text("id").primaryKey(),

		// service | deployment | pod | device | dependency
		kind: text("kind").notNull(),
		// stable natural key within a kind, e.g. "deployment/demo/checkout"
		externalId: text("external_id").notNull(),
		name: text("name").notNull(),
		attributes: jsonb("attributes"),

		// set when this row asserts a relationship rather than an entity
		relatesToId: text("relates_to_id"),
		relationKind: text("relation_kind"),

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
		index("cmdb_items_lookup_idx").on(t.kind, t.externalId, t.observedAt),
		index("cmdb_items_relation_idx").on(t.relatesToId),
		index("cmdb_items_source_idx").on(t.sourceTicketId),
		index("cmdb_items_run_idx").on(t.sourceRunId),
		index("cmdb_items_step_idx").on(t.sourceStepId),
	],
);
