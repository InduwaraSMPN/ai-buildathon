/**
 * Problems (via createProblem) + Changes (via persistChange/persistCabVote/persistPir) + links.
 * Depends on tickets (for problem_tickets + change_ticket_links) and users.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
	changeCabMembers,
	changes,
	changeTicketLinks,
} from "@/db/schema/changes";
import { problems } from "@/db/schema/problems";
import { persistCabVote, persistChange, persistPir } from "@/server/changes";
import { createProblem } from "@/server/problems";
import { CHANGE_DEFS, DEMO_USERS, daysFromEpoch, PROBLEM_DEFS } from "./data";

export async function seedProblemsAndChanges(
	ticketIds: string[],
): Promise<void> {
	// Get staff + admin ids for assignees
	const staffIds = DEMO_USERS.filter((u) => u.kind === "staff").map(
		(u) => u.id,
	);
	const reporterIds = DEMO_USERS.filter((u) => u.kind === "reporter").map(
		(u) => u.id,
	);

	// Fetch only incident tickets for problem linkage (problems require incidents)
	const { tickets } = await import("@/db/schema/tickets");
	const incidentRows = await db
		.select({ id: tickets.id })
		.from(tickets)
		.where(eq(tickets.recordType, "incident"));
	const incidentIds = incidentRows.map((r) => r.id);
	// Fallback to provided ticketIds if no incidents found (should not happen)
	const incidentPool = incidentIds.length ? incidentIds : ticketIds;

	// -------------------------------------------------------------------------
	// Problems — 8 via createProblem with ticketIds linking existing incidents
	// -------------------------------------------------------------------------
	const createdProblemIds: string[] = [];

	for (let i = 0; i < PROBLEM_DEFS.length; i++) {
		const def = PROBLEM_DEFS[i]!;
		// Link 2-3 tickets per problem from incident pool only
		const linkedTicketIds = [
			incidentPool[(i * 2) % incidentPool.length]!,
			incidentPool[(i * 2 + 1) % incidentPool.length]!,
			...(i % 2 === 0
				? [incidentPool[(i * 3 + 5) % incidentPool.length]!]
				: []),
		].filter(Boolean);

		// Check idempotency by title or existing problem with same title
		const existing = (
			await db
				.select({ id: problems.id })
				.from(problems)
				.where(eq(problems.title, def.title))
				.limit(1)
		)[0];
		if (existing) {
			createdProblemIds.push(existing.id);
			continue;
		}

		const assigneeId = staffIds[i % staffIds.length]!;
		try {
			const created = await createProblem(
				{
					title: def.title,
					description: def.description,
					priority: def.priority,
					assigneeId,
					serviceId: i % 2 === 0 ? "svc-infrastructure" : "svc-device",
					ticketIds: linkedTicketIds,
				},
				db,
			);
			// Patch isKnownError / workaround / rootCause + updatedAt for determinism
			await db
				.update(problems)
				.set({
					isKnownError: def.isKnownError,
					workaround: def.workaround,
					rootCause: def.rootCause,
					status:
						def.isKnownError && def.rootCause
							? "closed"
							: i % 3 === 0
								? "open"
								: i % 3 === 1
									? "open"
									: "closed",
					updatedAt: daysFromEpoch(10 + i, 11),
					createdAt: daysFromEpoch(5 + i, 9),
				})
				.where(eq(problems.id, created.id));
			createdProblemIds.push(created.id);
		} catch (err) {
			// On rerun duplication: lookup by title again
			const retry = (
				await db
					.select({ id: problems.id })
					.from(problems)
					.where(eq(problems.title, def.title))
					.limit(1)
			)[0];
			if (retry) createdProblemIds.push(retry.id);
			else
				console.warn(
					`[seed:problems] failed ${def.title}:`,
					(err as Error).message,
				);
		}
	}

	console.log(`[seed:problems] seeded ${createdProblemIds.length} problems`);

	// -------------------------------------------------------------------------
	// Changes — 10 via persistChange
	// -------------------------------------------------------------------------
	for (let i = 0; i < CHANGE_DEFS.length; i++) {
		const def = CHANGE_DEFS[i]!;
		// Check idempotency by id
		const existing = (
			await db
				.select({ id: changes.id })
				.from(changes)
				.where(eq(changes.id, def.id))
				.limit(1)
		)[0];
		if (existing) {
			continue;
		}

		const requesterId = reporterIds[i % reporterIds.length]!;
		const assignedToId = staffIds[i % staffIds.length]!;
		const workStartAt = daysFromEpoch(15 + i * 2, 9);
		const workEndAt = daysFromEpoch(15 + i * 2, 17);
		const outageStartAt =
			def.impact === "high" ? daysFromEpoch(15 + i * 2, 10) : null;
		const outageEndAt =
			def.impact === "high" ? daysFromEpoch(15 + i * 2, 12) : null;

		const createdById = staffIds[i % staffIds.length]!;

		try {
			await persistChange(
				{
					id: def.id,
					changeNumber: `CHG-2026-${String(i + 1).padStart(5, "0")}`,
					title: def.title,
					description: def.description,
					reasonForChange: `Business justification for ${def.title.toLowerCase()}`,
					changeType: def.changeType,
					status: def.status,
					priority: def.priority,
					impact: def.impact,
					category: def.changeType === "emergency" ? "emergency" : "standard",
					requesterId,
					assignedToId,
					createdById,
					cabRequired: def.cabRequired,
					cabApprovalType: def.cabApprovalType,
					workStartAt,
					workEndAt,
					outageStartAt,
					outageEndAt,
					implementationPlan: `Implementation plan for ${def.title}: Step 1 validate, Step 2 deploy, Step 3 verify`,
					testPlan:
						"Test plan: verify in staging, run smoke tests, monitor for 30 minutes",
					rollbackPlan:
						"Rollback: revert to previous version, restore snapshot if needed",
					riskEvaluation:
						def.impact === "high" ? "High risk — requires CAB" : "Low risk",
					riskLikelihood: def.impact === "high" ? 3 : 1,
					riskImpactScore: def.impact === "high" ? 4 : 2,
					riskScore: def.impact === "high" ? 12 : 2,
					riskLevel: def.impact === "high" ? "high" : "low",
					createdAt: daysFromEpoch(10 + i, 9),
					updatedAt: daysFromEpoch(10 + i, 10),
				},
				db,
			);
		} catch (err) {
			console.warn(
				`[seed:changes] persistChange failed ${def.id}:`,
				(err as Error).message,
			);
			continue;
		}

		// CAB members — 2-3 per cabRequired change
		if (def.cabRequired) {
			const cabUserIds = [
				staffIds[0]!,
				staffIds[1]!,
				...(def.cabApprovalType === "all" ? [staffIds[2]!] : []),
			];
			for (let j = 0; j < cabUserIds.length; j++) {
				const memberId = `demo-cab-member-${def.id}-${String(j + 1).padStart(2, "0")}`;
				const userId = cabUserIds[j]!;
				await db
					.insert(changeCabMembers)
					.values({
						id: memberId,
						changeId: def.id,
						userId,
						isRequired: true,
						createdAt: daysFromEpoch(11 + i, 9),
					})
					.onConflictDoNothing();

				// Persist vote for members (approve/reject pattern)
				// For demo-change-10 (failed) one reject to trigger rejected; others approve
				let vote: "approve" | "reject" | "abstain" = "approve";
				if (def.id === "demo-change-10" && j === 1) vote = "reject";
				if (def.id === "demo-change-03" && j === 2) vote = "abstain"; // pending_approval stays pending

				// Every CAB member votes, whatever the change's state, so each
				// change detail screen shows a populated vote panel.
				try {
					await persistCabVote(
						{
							memberId,
							vote,
							comment:
								vote === "approve"
									? "Looks good, approved"
									: vote === "reject"
										? "NACK — rollback risk not addressed"
										: "Abstain — need more info",
						},
						{ canVote: true },
						db,
					);
				} catch (err) {
					// May conflict on rerun — onConflictDoUpdate in persistCabVote handles it
					console.warn(
						`[seed:changes] persistCabVote failed ${memberId}:`,
						(err as Error).message,
					);
				}
			}
		}

		// PIR for 3 completed changes
		if (
			def.status === "completed" &&
			["demo-change-05", "demo-change-06"].includes(def.id)
		) {
			try {
				await persistPir(
					def.id,
					{
						pirReview: `Post-implementation review for ${def.title}: successful with no incidents`,
						pirWasSuccessful: true,
						pirActualStartAt: workStartAt,
						pirActualEndAt: workEndAt,
						pirLessonsLearned:
							"No lessons learned — process worked as expected",
						pirFollowUp: null,
					},
					db,
				);
			} catch {}
		}
		// Also add PIR for one failed change differently
		if (def.id === "demo-change-10") {
			try {
				await persistPir(
					def.id,
					{
						pirReview:
							"PIR identifies typo in CDN distribution ID — process gap in peer review",
						pirWasSuccessful: false,
						pirActualStartAt: workStartAt,
						pirActualEndAt: daysFromEpoch(15 + i * 2, 11),
						pirLessonsLearned:
							"Add automated check for distribution ID validity before purge",
						pirFollowUp: "Update runbook with verification step",
					},
					db,
				);
			} catch {}
		}

		// Change ↔ ticket links (2 per change)
		for (let k = 0; k < 2; k++) {
			const ticketId = ticketIds[(i * 2 + k) % ticketIds.length]!;
			const linkId = `demo-change-link-${def.id}-${String(k + 1).padStart(2, "0")}`;
			await db
				.insert(changeTicketLinks)
				.values({
					id: linkId,
					changeId: def.id,
					ticketId,
					linkType: k === 0 ? "related" : "implements",
					createdAt: daysFromEpoch(12 + i, 10),
				})
				.onConflictDoNothing();
		}
	}

	console.log(
		"[seed:changes] seeded 10 changes with CAB members, votes, PIR and ticket links",
	);
}
