/**
 * Tickets (~45) via createTicket() — drives numbering, audit, SLA stopwatches, search indexing, workflow dispatch.
 * Also seeds messages + time entries afterwards.
 * Depends on users, services.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ticketTimeEntries } from "@/db/schema/journal";
import { ticketMessages } from "@/db/schema/messages";
import { tickets } from "@/db/schema/tickets";
import { indexTicket } from "@/server/search/projections";
import {
	createTicketInTransaction,
	finalizeCreatedTicket,
} from "@/server/tickets/create";
import {
	DEMO_USERS,
	daysFromEpoch,
	demoTicketIdempotencyKey,
	REAL_ADMIN_EMAIL,
	REAL_REPORTER_EMAIL,
	TICKET_TITLES,
} from "./data";

// Desired status flow for demo: we create via ticket with default status (open), then patch some rows
// to pending/resolved/closed to show mixed statuses without needing full status machine.
// Also create SLA-breached via escalation_flag.

const STATUS_PATCH: Record<
	number,
	{
		status: string;
		escalationFlag?: string;
		resolution?: string;
		resolutionCode?: string;
	}
> = {
	// P1 SLA-breached (first 3)
	0: { status: "open", escalationFlag: "breach" },
	1: { status: "pending", escalationFlag: "breach" },
	2: { status: "escalated", escalationFlag: "breach" },
	// Mixed
	3: { status: "open" },
	4: { status: "pending" },
	5: { status: "resolving" },
	6: { status: "open" },
	7: { status: "pending" },
	8: {
		status: "resolved",
		resolution: "Fixed by updating SPF record and retrying queue",
		resolutionCode: "fixed",
	},
	9: {
		status: "closed",
		resolution: "Access provisioned and verified",
		resolutionCode: "fixed",
	},
	10: {
		status: "closed",
		resolution: "CI runner disk cleaned, cache invalidated",
		resolutionCode: "fixed",
	},
	11: { status: "open" },
	12: { status: "pending" },
	13: { status: "escalated" },
	14: {
		status: "resolved",
		resolution: "Laptop replacement arranged, tracking updated",
		resolutionCode: "fixed",
	},
	15: { status: "open" },
	16: { status: "pending" },
	17: { status: "open" },
	18: { status: "open" },
	19: {
		status: "resolved",
		resolution: "Isolated host, no lateral movement, reimaged",
		resolutionCode: "fixed",
	},
	20: {
		status: "closed",
		resolution: "Workaround documented, vendor ticket opened",
		resolutionCode: "workaround",
	},
	21: { status: "pending" },
	22: { status: "open", escalationFlag: "warning" },
	23: {
		status: "closed",
		resolution: "Accounts provisioned, access verified",
		resolutionCode: "fixed",
	},
	24: { status: "open" },
	25: { status: "pending" },
	26: {
		status: "resolved",
		resolution: "Investigated forecast formula, corrected off-by-one in range",
		resolutionCode: "fixed",
	},
	27: { status: "open" },
	28: { status: "open" },
	29: { status: "pending" },
	30: { status: "open" },
	31: {
		status: "closed",
		resolution: "Offsite budget approved by Finance",
		resolutionCode: "fixed",
	},
	32: { status: "open" },
	33: { status: "open" },
	34: { status: "pending" },
	35: { status: "open" },
	36: { status: "open" },
	37: {
		status: "closed",
		resolution: "VAT fix deployed and verified on staging",
		resolutionCode: "fixed",
	},
	38: { status: "pending" },
	39: {
		status: "resolved",
		resolution: "Revoked access for leavers, sync rule fixed",
		resolutionCode: "fixed",
	},
	40: { status: "open" },
	41: { status: "pending" },
	42: { status: "open" },
	43: { status: "open" },
	44: {
		status: "closed",
		resolution: "Invoice corrected, credit note issued",
		resolutionCode: "fixed",
	},
};

export async function seedTickets(): Promise<string[]> {
	// Admin is referenced as an assignee on some tickets; it is a pre-existing
	// real user, so it is looked up by email rather than seeded.
	const { user } = await import("@/db/schema/auth");
	const adminRow = REAL_ADMIN_EMAIL
		? (
				await db
					.select({ id: user.id })
					.from(user)
					.where(eq(user.email, REAL_ADMIN_EMAIL))
					.limit(1)
			)[0]
		: undefined;
	const adminId = adminRow?.id ?? DEMO_USERS[0]!.id;

	// The portal demo is driven by the real employee account, so a slice of the
	// tickets must be reported by it — otherwise "My requests" renders empty.
	// Looked up by email (never seeded/modified); falls back to demo reporters.
	const portalRow = REAL_REPORTER_EMAIL
		? (
				await db
					.select({ id: user.id })
					.from(user)
					.where(eq(user.email, REAL_REPORTER_EMAIL))
					.limit(1)
			)[0]
		: undefined;
	const portalUserId = portalRow?.id ?? null;

	const createdIds: string[] = [];
	const staffIds = DEMO_USERS.filter((u) => u.kind === "staff").map(
		(u) => u.id,
	);
	const reporterIds = DEMO_USERS.filter((u) => u.kind === "reporter").map(
		(u) => u.id,
	);

	// Ensure we have exactly 45 titles — TICKET_TITLES is 45
	const total = TICKET_TITLES.length; // should be 45

	for (let i = 0; i < total; i++) {
		const def = TICKET_TITLES[i]!;
		// The creation claim is unique on (reporterId, idempotencyKey), so the
		// reporter used at creation must stay stable or a rerun mints a second
		// ticket. Creation always uses the demo reporter; every 6th ticket is
		// then repointed to the real portal account in the patch step below.
		const reporterId = reporterIds[i % reporterIds.length]!;
		const finalReporterId =
			portalUserId && i % 6 === 0 ? portalUserId : reporterId;
		const idempotencyKey = demoTicketIdempotencyKey(i);
		// Alternate assignees: some unassigned (every 5th), some admin, some staff
		let assigneeId: string | null | undefined;
		if (i % 7 === 6)
			assigneeId = null; // unassigned
		else if (i % 5 === 0) assigneeId = adminId;
		else assigneeId = staffIds[i % staffIds.length]!;

		const teamId =
			i % 7 === 6
				? null
				: i % 4 === 0
					? "demo-team-platform"
					: i % 4 === 1
						? "demo-team-helpdesk"
						: null;

		try {
			const result = await db.transaction(async (tx) => {
				return createTicketInTransaction(tx, {
					source: "portal",
					reporterId,
					title: def.title,
					body: def.body,
					serviceId: def.serviceId as never,
					serviceSubcategoryId: def.serviceSubcategoryId as never,
					recordType: def.recordType,
					impact: def.impact,
					urgency: def.urgency,
					idempotencyKey,
					origin: "portal",
				});
			});

			// Determine internal ticket id for patching — result.ticketId
			const ticketId = result.ticketId;
			createdIds.push(ticketId);

			// Patch row for demo status / escalation / assignee / team / timestamps
			const patch = STATUS_PATCH[i];
			if (patch) {
				const createdAt = daysFromEpoch(i % 25, 9 + (i % 8));
				const updatedAt = daysFromEpoch((i % 25) + 1, 10);
				const resolvedAt =
					patch.status === "resolved" || patch.status === "closed"
						? daysFromEpoch((i % 25) + 2, 11)
						: null;
				const closedAt =
					patch.status === "closed" ? daysFromEpoch((i % 25) + 3, 11) : null;
				await db
					.update(tickets)
					.set({
						status: patch.status as typeof tickets.$inferInsert.status,
						escalationFlag:
							(patch.escalationFlag as typeof tickets.$inferInsert.escalationFlag) ??
							"none",
						escalationReason:
							patch.escalationFlag === "breach"
								? "SLA breach — response time exceeded"
								: patch.escalationFlag === "warning"
									? "Approaching SLA threshold"
									: null,
						reporterId: finalReporterId,
						assigneeId: assigneeId ?? null,
						teamId,
						resolution: patch.resolution ?? null,
						resolutionCode:
							(patch.resolutionCode as typeof tickets.$inferInsert.resolutionCode) ??
							null,
						resolvedAt,
						closedAt,
						createdAt,
						updatedAt,
					})
					.where(eq(tickets.id, ticketId));
			} else {
				// Still patch assignee/team/timestamps for realism
				const createdAt = daysFromEpoch(i % 25, 9 + (i % 8));
				await db
					.update(tickets)
					.set({
						reporterId: finalReporterId,
						assigneeId: assigneeId ?? null,
						teamId,
						createdAt,
						updatedAt: daysFromEpoch((i % 25) + 1, 10),
					})
					.where(eq(tickets.id, ticketId));
			}

			// Ensure search indexing (idempotent)
			try {
				await indexTicket(db, ticketId);
			} catch {}

			// Void finalize (already indexed; workflow dispatch soft-fails)
			if (result.created) {
				try {
					await finalizeCreatedTicket(result, { reporterId });
				} catch {}
			}
		} catch (err) {
			// On rerun, createTicketInTransaction may throw "in progress" or already exists; try to recover existing ticket
			// Find existing ticket by idempotency claim
			const { ticketCreationClaims } = await import("@/db/schema/tickets");
			const existing = (
				await db
					.select({ ticketId: ticketCreationClaims.ticketId })
					.from(ticketCreationClaims)
					.where(eq(ticketCreationClaims.idempotencyKey, idempotencyKey))
					.limit(1)
			)[0];
			if (existing?.ticketId) {
				createdIds.push(existing.ticketId);
			} else {
				console.warn(
					`[seed:tickets] failed to create ticket ${i}:`,
					(err as Error).message,
				);
			}
		}
	}

	// Seed messages + time entries on ~20 tickets (2-4 per ticket)
	const messageBodies = [
		"Thanks for the update — can you confirm when this will be resolved?",
		"Investigated and applied a temporary workaround. Monitoring for 30 minutes.",
		"Escalating to Platform Engineering for deeper investigation.",
		"Fixed and verified on staging. Ready to deploy to production pending CAB.",
		"User confirmed the issue is resolved. Closing as fixed.",
		"Need more information: what is the exact error message and browser?",
	];
	for (let i = 0; i < Math.min(20, createdIds.length); i++) {
		const ticketId = createdIds[i]!;
		const count = 2 + (i % 3); // 2-4
		for (let j = 0; j < count; j++) {
			const author = DEMO_USERS[(i + j) % DEMO_USERS.length]!;
			const authorType = author.kind === "staff" ? "staff" : "reporter";
			const id = `demo-msg-${String(i).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
			const createdAt = daysFromEpoch((i % 25) + 1 + j, 10 + j);
			await db
				.insert(ticketMessages)
				.values({
					id,
					ticketId,
					authorId: author.id,
					authorType,
					body: messageBodies[(i + j) % messageBodies.length]!,
					visibility: j === 2 ? "private" : "public",
					createdAt,
				})
				.onConflictDoNothing();

			// Time entry for staff messages on ~half the tickets
			if (authorType === "staff" && j % 2 === 0) {
				const timeId = `demo-time-${String(i).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
				await db
					.insert(ticketTimeEntries)
					.values({
						id: timeId,
						ticketId,
						userId: author.id,
						minutes: 15 + j * 10,
						note: `Time spent investigating ticket ${ticketId.slice(0, 8)}`,
						createdAt,
					})
					.onConflictDoNothing();
			}
		}
	}

	console.log(
		`[seed:tickets] seeded ${createdIds.length} tickets + messages/time entries`,
	);
	return createdIds;
}
