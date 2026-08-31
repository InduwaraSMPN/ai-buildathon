import { relations } from "drizzle-orm";
import {
	foreignKey,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import {
	IMPACT_LEVELS,
	PRIORITIES,
	PROGRESS_MARKERS,
	RECORD_TYPES,
	RESOLUTION_CODES,
	TICKET_ROUTES,
	URGENCY_LEVELS,
} from "@/shared";
import { user } from "./auth";
import { serviceSubcategories, services } from "./catalogue";
import { devices } from "./devices";
import { teams } from "./org";
import { pendingReasons } from "./pending";
import { ticketStatuses } from "./vocabulary";

/**
 * A support request opened by an employee.
 *
 * `route` is the team or system Axel decided owns this, and stays null until
 * routing runs. `resolution` explains the outcome in the employee's terms and is
 * written for both closure and escalation.
 */
export const tickets = pgTable(
	"tickets",
	{
		id: text("id").primaryKey(),
		reporterId: text("reporter_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		deviceId: text("device_id").references(() => devices.id, {
			onDelete: "set null",
		}),

		title: text("title").notNull(),
		body: text("body").notNull(),
		recordType: text("record_type", { enum: RECORD_TYPES })
			.notNull()
			.default("incident"),
		impact: text("impact", { enum: IMPACT_LEVELS }).notNull().default("medium"),
		urgency: text("urgency", { enum: URGENCY_LEVELS })
			.notNull()
			.default("medium"),
		priority: text("priority", { enum: PRIORITIES }).notNull().default("P3"),
		serviceId: text("service_id")
			.notNull()
			.default("svc-general")
			.references(() => services.id, { onDelete: "restrict" }),
		serviceSubcategoryId: text("service_subcategory_id")
			.notNull()
			.default("ss-general"),
		status: text("status")
			.notNull()
			.default("open")
			.references(() => ticketStatuses.key),
		route: text("route", { enum: TICKET_ROUTES }),
		resolution: text("resolution"),
		resolutionCode: text("resolution_code", { enum: RESOLUTION_CODES }),
		escalationNote: text("escalation_note"),
		progressMarker: text("progress_marker", { enum: PROGRESS_MARKERS }),
		assigneeId: text("assignee_id").references(() => user.id, {
			onDelete: "set null",
		}),
		ownerId: text("owner_id").references(() => user.id, {
			onDelete: "set null",
		}),
		teamId: text("team_id").references(() => teams.id, {
			onDelete: "set null",
		}),
		mergedIntoId: text("merged_into_id"),
		number: text("number").unique(),
		pendingReasonId: text("pending_reason_id"),
		pendingUntil: timestamp("pending_until"),
		lastPendingAt: timestamp("last_pending_at"),
		pendingFollowups: integer("pending_followups").notNull().default(0),
		escalationFlag: text("escalation_flag", {
			enum: ["none", "warning", "breach"],
		})
			.notNull()
			.default("none"),
		escalationReason: text("escalation_reason"),
		version: integer("version").notNull().default(1),

		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		resolvedAt: timestamp("resolved_at"),
		closedAt: timestamp("closed_at"),
		reopenedAt: timestamp("reopened_at"),
		lastHumanTransitionAt: timestamp("last_human_transition_at"),
	},
	(t) => [
		index("tickets_reporter_idx").on(t.reporterId),
		index("tickets_status_idx").on(t.status, t.createdAt),
		index("tickets_priority_idx").on(t.priority, t.createdAt),
		index("tickets_type_idx").on(t.recordType, t.status),
		index("tickets_device_idx").on(t.deviceId),
		index("tickets_service_idx").on(t.serviceId, t.serviceSubcategoryId),
		index("tickets_assignee_id_idx").on(t.assigneeId),
		index("tickets_owner_id_idx").on(t.ownerId),
		index("tickets_team_id_idx").on(t.teamId),
		index("tickets_pending_reason_id_idx").on(t.pendingReasonId),
		index("tickets_merged_into_id_idx").on(t.mergedIntoId),
		index("tickets_service_subcategory_id_service_id_idx").on(
			t.serviceSubcategoryId,
			t.serviceId,
		),
		foreignKey({
			columns: [t.serviceSubcategoryId, t.serviceId],
			foreignColumns: [serviceSubcategories.id, serviceSubcategories.serviceId],
			name: "tickets_subcategory_service_fk",
		}).onDelete("restrict"),
		foreignKey({
			columns: [t.mergedIntoId],
			foreignColumns: [t.id],
			name: "tickets_merged_into_fk",
		}).onDelete("set null"),
		foreignKey({
			columns: [t.pendingReasonId],
			foreignColumns: [pendingReasons.id],
			name: "tickets_pending_reason_fk",
		}).onDelete("set null"),
	],
);

export const ticketCreationClaims = pgTable(
	"ticket_creation_claims",
	{
		id: text("id").primaryKey(),
		reporterId: text("reporter_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		idempotencyKey: text("idempotency_key").notNull(),
		ticketId: text("ticket_id").references(() => tickets.id, {
			onDelete: "cascade",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		expiresAt: timestamp("expires_at").notNull(),
	},
	(t) => [
		uniqueIndex("ticket_creation_claims_reporter_key_uidx").on(
			t.reporterId,
			t.idempotencyKey,
		),
		index("ticket_creation_claims_expiry_idx").on(t.expiresAt),
	],
);

export const ticketTransitions = pgTable(
	"ticket_transitions",
	{
		id: text("id").primaryKey(),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		fromStatus: text("from_status").notNull(),
		toStatus: text("to_status").notNull(),
		action: text("action").notNull(),
		actorType: text("actor_type", { enum: ["human", "agent"] }).notNull(),
		actorId: text("actor_id"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [index("ticket_transitions_ticket_idx").on(t.ticketId, t.createdAt)],
);

export const ticketsRelations = relations(tickets, ({ one }) => ({
	reporter: one(user, {
		fields: [tickets.reporterId],
		references: [user.id],
	}),
}));
