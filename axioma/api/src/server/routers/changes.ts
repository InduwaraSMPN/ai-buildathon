import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	changeCabMembers,
	changeCabVotes,
	changes,
	changeTicketLinks,
	changeTransitions,
	ticketNumberCounters,
} from "@/db/schema";
import { canChangeProceed, changeApproval } from "../changes";
import { capabilityProcedure } from "../orpc";

async function getChange(id: string) {
	const change = (
		await db.select().from(changes).where(eq(changes.id, id)).limit(1)
	)[0];
	if (!change) return null;
	const [links, members] = await Promise.all([
		db
			.select({ ticketId: changeTicketLinks.ticketId })
			.from(changeTicketLinks)
			.where(eq(changeTicketLinks.changeId, id)),
		db
			.select({
				id: changeCabMembers.id,
				userId: changeCabMembers.userId,
				isRequired: changeCabMembers.isRequired,
				vote: changeCabVotes.vote,
				voteComment: changeCabVotes.comment,
				voteAt: changeCabVotes.votedAt,
			})
			.from(changeCabMembers)
			.leftJoin(
				changeCabVotes,
				eq(changeCabVotes.memberId, changeCabMembers.id),
			)
			.where(eq(changeCabMembers.changeId, id)),
	]);
	return {
		...change,
		ticketIds: links.map(({ ticketId }) => ticketId),
		cabMembers: members,
	};
}

async function requireChange(id: string) {
	const change = await getChange(id);
	if (!change) throw new ORPCError("NOT_FOUND");
	return change;
}

export const changesRouter = {
	listChanges: capabilityProcedure("change.manage").listChanges.handler(() =>
		db.select().from(changes).orderBy(desc(changes.createdAt)),
	),
	getChange: capabilityProcedure("change.manage").getChange.handler(
		({ input }) => getChange(input.id),
	),
	createChange: capabilityProcedure("change.manage").createChange.handler(
		async ({ context, input }) => {
			const id = crypto.randomUUID();
			const year = String(new Date().getUTCFullYear());
			const cabRequired = true;
			await db.transaction(async (tx) => {
				const counter = (
					await tx
						.insert(ticketNumberCounters)
						.values({ prefix: "CHG", year, lastValue: 1 })
						.onConflictDoUpdate({
							target: [ticketNumberCounters.prefix, ticketNumberCounters.year],
							set: { lastValue: sql`${ticketNumberCounters.lastValue} + 1` },
						})
						.returning({ value: ticketNumberCounters.lastValue })
				)[0];
				if (!counter) throw new ORPCError("INTERNAL_SERVER_ERROR");
				await tx.insert(changes).values({
					id,
					changeNumber: `CHG-${year}-${String(counter.value).padStart(5, "0")}`,
					title: input.title,
					description: input.description,
					reasonForChange: input.reasonForChange,
					changeType: input.changeType,
					status: "pending_approval",
					testPlan: input.testPlan,
					rollbackPlan: input.rollbackPlan,
					cabRequired,
					requesterId: context.userId,
					createdById: context.userId,
				});
				await tx.insert(changeTransitions).values({
					id: crypto.randomUUID(),
					changeId: id,
					fromStatus: "draft",
					toStatus: "pending_approval",
					actorType: "human",
					actorId: context.userId,
				});
				const memberIds = [...new Set(input.cabMemberIds)];
				if (memberIds.length)
					await tx.insert(changeCabMembers).values(
						memberIds.map((userId) => ({
							id: crypto.randomUUID(),
							changeId: id,
							userId,
						})),
					);
				const ticketIds = [...new Set(input.ticketIds)];
				if (ticketIds.length)
					await tx.insert(changeTicketLinks).values(
						ticketIds.map((ticketId) => ({
							id: crypto.randomUUID(),
							changeId: id,
							ticketId,
						})),
					);
			});
			return requireChange(id);
		},
	),
	updateChange: capabilityProcedure("change.manage").updateChange.handler(
		async ({ context, input: { id, status, ...pir } }) => {
			const current = await requireChange(id);
			if (
				status === "in_progress" &&
				current.changeType !== "standard" &&
				!canChangeProceed(
					current.changeType,
					current.cabMembers,
					current.cabRequired,
					current.cabApprovalType,
				)
			)
				throw new ORPCError("CONFLICT", {
					message: "This change requires CAB approval before work starts",
				});
			if (
				status === "completed" &&
				!(pir.pirWasSuccessful ?? current.pirWasSuccessful) &&
				!(pir.pirLessonsLearned ?? current.pirLessonsLearned)
			)
				throw new ORPCError("BAD_REQUEST", {
					message: "A completed change requires a post-implementation review",
				});
			const patch = {
				...pir,
				...(status ? { status } : {}),
				updatedAt: new Date(),
			};
			const updated = await db.transaction(async (tx) => {
				const row = await tx
					.update(changes)
					.set(patch)
					.where(eq(changes.id, id))
					.returning({ id: changes.id, status: changes.status });
				if (!row[0]) throw new ORPCError("NOT_FOUND");
				if (status && status !== current.status)
					await tx.insert(changeTransitions).values({
						id: crypto.randomUUID(),
						changeId: id,
						fromStatus: current.status,
						toStatus: status,
						actorType: "human",
						actorId: context.userId,
					});
				return row[0];
			});
			return requireChange(updated.id);
		},
	),
	voteOnChange: capabilityProcedure("change.approve").voteOnChange.handler(
		async ({ context, input }) => {
			const member = (
				await db
					.select()
					.from(changeCabMembers)
					.where(
						and(
							eq(changeCabMembers.changeId, input.changeId),
							eq(changeCabMembers.userId, context.userId),
						),
					)
					.limit(1)
			)[0];
			if (!member) throw new ORPCError("FORBIDDEN");
			const votedAt = new Date();
			await db
				.insert(changeCabVotes)
				.values({
					id: crypto.randomUUID(),
					memberId: member.id,
					vote: input.vote,
					comment: input.comment,
					votedAt,
				})
				.onConflictDoUpdate({
					target: changeCabVotes.memberId,
					set: { vote: input.vote, comment: input.comment, votedAt },
				});
			const detail = await requireChange(input.changeId);
			const nextStatus = changeApproval(
				detail.changeType,
				detail.cabMembers,
				detail.cabRequired,
				detail.cabApprovalType,
			);
			if (nextStatus !== detail.status) {
				await db.transaction(async (tx) => {
					await tx
						.update(changes)
						.set({ status: nextStatus, updatedAt: votedAt })
						.where(eq(changes.id, input.changeId));
					await tx.insert(changeTransitions).values({
						id: crypto.randomUUID(),
						changeId: input.changeId,
						fromStatus: detail.status,
						toStatus: nextStatus,
						actorType: "human",
						actorId: context.userId,
					});
				});
			}
			return requireChange(input.changeId);
		},
	),
};
