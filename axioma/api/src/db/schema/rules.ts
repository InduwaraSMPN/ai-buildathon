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
import type { RuleAction, RuleCriterion, RuleFiring } from "@/domain/rules";
import { tickets } from "./tickets";

/** Ordered ticket-create rules. Criteria are ANDed; action conflicts use first-match-wins. */
export const ticketRules = pgTable(
	"ticket_rules",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		position: integer("position").notNull(),
		criteria: jsonb("criteria").$type<RuleCriterion[]>().notNull(),
		actions: jsonb("actions").$type<RuleAction[]>().notNull(),
		enabled: boolean("enabled").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("ticket_rules_position_uidx").on(t.position),
		check("ticket_rules_position_nonnegative", sql`${t.position} >= 0`),
	],
);

/** Immutable, replayable explanation of one rule evaluation that changed a ticket. */
export const ticketRuleFirings = pgTable(
	"ticket_rule_firings",
	{
		id: text("id").primaryKey(),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		ruleId: text("rule_id")
			.notNull()
			.references(() => ticketRules.id, { onDelete: "restrict" }),
		rulePosition: integer("rule_position").notNull(),
		result: jsonb("result").$type<RuleFiring>().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("ticket_rule_firings_ticket_idx").on(t.ticketId, t.createdAt),
		index("ticket_rule_firings_rule_id_idx").on(t.ruleId),
	],
);
