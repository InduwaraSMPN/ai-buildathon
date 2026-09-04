import { sql } from "drizzle-orm";
import {
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { formSubmissions } from "./forms";
import { tickets } from "./tickets";

/** Single-step request approval; one row is the complete decision lifecycle. */
export const approvals = pgTable(
	"approvals",
	{
		id: text("id").primaryKey(),
		// Cascades with the ticket, which is itself cascaded from the reporter.
		// RESTRICT on these two made offboarding — and any erasure request —
		// impossible, because the cascade could never reach the approval row.
		requesterId: text("requester_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		approverId: text("approver_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		submissionId: text("submission_id").references(() => formSubmissions.id, {
			onDelete: "set null",
		}),
		status: text("status", {
			enum: ["waiting_for_approval", "approved", "rejected"],
		})
			.notNull()
			.default("waiting_for_approval"),
		requestNote: text("request_note"),
		decisionNote: text("decision_note"),
		requestedAt: timestamp("requested_at").defaultNow().notNull(),
		decidedAt: timestamp("decided_at"),
	},
	(t) => [
		uniqueIndex("approvals_active_ticket_uidx")
			.on(t.ticketId)
			.where(sql`${t.status} = 'waiting_for_approval'`),
		index("approvals_approver_status_idx").on(
			t.approverId,
			t.status,
			t.requestedAt,
		),
		index("approvals_requester_idx").on(t.requesterId, t.requestedAt),
		index("approvals_submission_id_idx").on(t.submissionId),
	],
);
