import { relations, sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { IMPACT_LEVELS, PRIORITIES } from "@/shared";
import { agentRuns, agentSteps } from "./agent";
import { user } from "./auth";
import { tickets } from "./tickets";

export const CHANGE_TYPES = ["standard", "normal", "emergency"] as const;
export const CHANGE_STATUSES = [
	"draft",
	"submitted",
	"pending_approval",
	"approved",
	"rejected",
	"scheduled",
	"in_progress",
	"completed",
	"failed",
	"cancelled",
] as const;
export const CAB_APPROVAL_TYPES = ["all", "majority"] as const;
export const CAB_VOTES = ["approve", "reject", "abstain"] as const;
export const CHANGE_TICKET_LINK_TYPES = [
	"related",
	"implements",
	"caused_by",
] as const;

export type ChangeType = (typeof CHANGE_TYPES)[number];
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];
export type CabApprovalType = (typeof CAB_APPROVAL_TYPES)[number];
export type CabVote = (typeof CAB_VOTES)[number];
export type ChangeTicketLinkType = (typeof CHANGE_TICKET_LINK_TYPES)[number];

export const changes = pgTable(
	"changes",
	{
		id: text("id").primaryKey(),
		changeNumber: text("change_number").notNull(),
		title: text("title").notNull(),
		description: text("description"),
		reasonForChange: text("reason_for_change"),

		changeType: text("change_type", { enum: CHANGE_TYPES })
			.notNull()
			.default("normal"),
		status: text("status", { enum: CHANGE_STATUSES })
			.notNull()
			.default("draft"),
		priority: text("priority", { enum: PRIORITIES }).notNull().default("P3"),
		impact: text("impact", { enum: IMPACT_LEVELS }).notNull().default("medium"),
		category: text("category"),

		requesterId: text("requester_id").references(() => user.id, {
			onDelete: "set null",
		}),
		assignedToId: text("assigned_to_id").references(() => user.id, {
			onDelete: "set null",
		}),
		approverId: text("approver_id").references(() => user.id, {
			onDelete: "set null",
		}),
		approvalAt: timestamp("approval_at"),

		workStartAt: timestamp("work_start_at"),
		workEndAt: timestamp("work_end_at"),
		outageStartAt: timestamp("outage_start_at"),
		outageEndAt: timestamp("outage_end_at"),
		implementationPlan: text("implementation_plan"),
		testPlan: text("test_plan"),
		rollbackPlan: text("rollback_plan"),

		riskEvaluation: text("risk_evaluation"),
		riskLikelihood: integer("risk_likelihood"),
		riskImpactScore: integer("risk_impact_score"),
		riskScore: integer("risk_score"),
		riskLevel: text("risk_level"),

		cabRequired: boolean("cab_required").notNull().default(false),
		cabApprovalType: text("cab_approval_type", { enum: CAB_APPROVAL_TYPES })
			.notNull()
			.default("all"),

		pirReview: text("pir_review"),
		pirWasSuccessful: boolean("pir_was_successful"),
		pirActualStartAt: timestamp("pir_actual_start_at"),
		pirActualEndAt: timestamp("pir_actual_end_at"),
		pirLessonsLearned: text("pir_lessons_learned"),
		pirFollowUp: text("pir_follow_up"),

		createdById: text("created_by_id").references(() => user.id, {
			onDelete: "set null",
		}),
		sourceRunId: text("source_run_id").references(() => agentRuns.id, {
			onDelete: "set null",
		}),
		sourceStepId: text("source_step_id").references(() => agentSteps.id, {
			onDelete: "set null",
		}),
		verificationDeadlineAt: timestamp("verification_deadline_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("changes_number_uidx").on(t.changeNumber),
		index("changes_status_schedule_idx").on(t.status, t.workStartAt),
		index("changes_type_status_idx").on(t.changeType, t.status),
		index("changes_priority_idx").on(t.priority, t.createdAt),
		index("changes_assignee_idx").on(t.assignedToId, t.status),
		index("changes_requester_idx").on(t.requesterId),
		index("changes_approver_idx").on(t.approverId),
		index("changes_risk_idx").on(t.riskLevel, t.riskScore),
		index("changes_source_run_idx").on(t.sourceRunId),
		index("changes_source_step_idx").on(t.sourceStepId),
		index("changes_created_by_id_idx").on(t.createdById),
		index("changes_verification_deadline_idx")
			.on(t.verificationDeadlineAt)
			.where(sql`${t.status} = 'in_progress'`),
	],
);

export const changeCabMembers = pgTable(
	"change_cab_members",
	{
		id: text("id").primaryKey(),
		changeId: text("change_id")
			.notNull()
			.references(() => changes.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		isRequired: boolean("is_required").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("change_cab_members_change_user_uidx").on(t.changeId, t.userId),
		index("change_cab_members_user_idx").on(t.userId, t.changeId),
	],
);

export const changeCabVotes = pgTable(
	"change_cab_votes",
	{
		id: text("id").primaryKey(),
		memberId: text("member_id")
			.notNull()
			.references(() => changeCabMembers.id, { onDelete: "cascade" }),
		vote: text("vote", { enum: CAB_VOTES }).notNull(),
		comment: text("comment"),
		votedAt: timestamp("voted_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("change_cab_votes_member_uidx").on(t.memberId)],
);

export const changeTicketLinks = pgTable(
	"change_ticket_links",
	{
		id: text("id").primaryKey(),
		changeId: text("change_id")
			.notNull()
			.references(() => changes.id, { onDelete: "cascade" }),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		linkType: text("link_type", { enum: CHANGE_TICKET_LINK_TYPES })
			.notNull()
			.default("related"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("change_ticket_links_pair_uidx").on(
			t.changeId,
			t.ticketId,
			t.linkType,
		),
		index("change_ticket_links_ticket_idx").on(t.ticketId),
	],
);

export const changeTransitions = pgTable(
	"change_transitions",
	{
		id: text("id").primaryKey(),
		changeId: text("change_id")
			.notNull()
			.references(() => changes.id, { onDelete: "cascade" }),
		fromStatus: text("from_status", { enum: CHANGE_STATUSES }).notNull(),
		toStatus: text("to_status", { enum: CHANGE_STATUSES }).notNull(),
		actorType: text("actor_type", { enum: ["human", "agent"] }).notNull(),
		actorId: text("actor_id"),
		runId: text("run_id").references(() => agentRuns.id, {
			onDelete: "set null",
		}),
		stepId: text("step_id").references(() => agentSteps.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("change_transitions_change_idx").on(t.changeId, t.createdAt),
		index("change_transitions_run_idx").on(t.runId),
		index("change_transitions_step_idx").on(t.stepId),
	],
);

export const changesRelations = relations(changes, ({ one, many }) => ({
	requester: one(user, {
		fields: [changes.requesterId],
		references: [user.id],
		relationName: "changeRequester",
	}),
	assignee: one(user, {
		fields: [changes.assignedToId],
		references: [user.id],
		relationName: "changeAssignee",
	}),
	approver: one(user, {
		fields: [changes.approverId],
		references: [user.id],
		relationName: "changeApprover",
	}),
	createdBy: one(user, {
		fields: [changes.createdById],
		references: [user.id],
		relationName: "changeCreator",
	}),
	sourceRun: one(agentRuns, {
		fields: [changes.sourceRunId],
		references: [agentRuns.id],
	}),
	sourceStep: one(agentSteps, {
		fields: [changes.sourceStepId],
		references: [agentSteps.id],
	}),
	cabMembers: many(changeCabMembers),
	ticketLinks: many(changeTicketLinks),
	transitions: many(changeTransitions),
}));

export const changeCabMembersRelations = relations(
	changeCabMembers,
	({ one }) => ({
		change: one(changes, {
			fields: [changeCabMembers.changeId],
			references: [changes.id],
		}),
		user: one(user, {
			fields: [changeCabMembers.userId],
			references: [user.id],
		}),
	}),
);

export const changeCabVotesRelations = relations(changeCabVotes, ({ one }) => ({
	member: one(changeCabMembers, {
		fields: [changeCabVotes.memberId],
		references: [changeCabMembers.id],
	}),
}));

export const changeTicketLinksRelations = relations(
	changeTicketLinks,
	({ one }) => ({
		change: one(changes, {
			fields: [changeTicketLinks.changeId],
			references: [changes.id],
		}),
		ticket: one(tickets, {
			fields: [changeTicketLinks.ticketId],
			references: [tickets.id],
		}),
	}),
);

export const changeTransitionsRelations = relations(
	changeTransitions,
	({ one }) => ({
		change: one(changes, {
			fields: [changeTransitions.changeId],
			references: [changes.id],
		}),
		run: one(agentRuns, {
			fields: [changeTransitions.runId],
			references: [agentRuns.id],
		}),
		step: one(agentSteps, {
			fields: [changeTransitions.stepId],
			references: [agentSteps.id],
		}),
	}),
);
