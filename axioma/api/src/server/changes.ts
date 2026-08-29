import { eq } from "drizzle-orm";
import {
	type CabVote,
	type ChangeType,
	changeCabVotes,
	changes,
} from "@/db/schema/changes";

export type CabMemberVote = Readonly<{
	isRequired: boolean;
	vote?: CabVote | null;
}>;

export type CabVoteCapability = boolean | Readonly<{ canVote: boolean }>;
export type ChangeApproval = "approved" | "pending_approval" | "rejected";

/** Standard changes are preapproved; every other change waits for required CAB approvals. */
export function changeApproval(
	changeType: ChangeType,
	members: readonly CabMemberVote[],
	cabRequired = changeType !== "standard",
	approvalType: "all" | "majority" = "all",
): ChangeApproval {
	if (changeType === "standard") return "approved";
	if (!cabRequired) return "approved";
	if (members.some(({ vote }) => vote === "reject")) return "rejected";
	const required = members.filter(({ isRequired }) => isRequired);
	if (!required.length) return "pending_approval";
	const approvals = required.filter(({ vote }) => vote === "approve").length;
	return approvalType === "majority"
		? approvals > required.length / 2
			? "approved"
			: "pending_approval"
		: approvals === required.length
			? "approved"
			: "pending_approval";
}

export function canChangeProceed(
	changeType: ChangeType,
	members: readonly CabMemberVote[],
	cabRequired = changeType !== "standard",
	approvalType: "all" | "majority" = "all",
): boolean {
	return (
		changeApproval(changeType, members, cabRequired, approvalType) ===
		"approved"
	);
}

export function assertCabVoteAuthorized(capability: CabVoteCapability): void {
	if (!(typeof capability === "boolean" ? capability : capability.canVote))
		throw new Error("Not authorized to vote on this change");
}

type Database = Awaited<ReturnType<typeof loadDatabase>>;
type ChangeInsert = typeof changes.$inferInsert;
type PirUpdate = Pick<
	typeof changes.$inferInsert,
	| "pirReview"
	| "pirWasSuccessful"
	| "pirActualStartAt"
	| "pirActualEndAt"
	| "pirLessonsLearned"
	| "pirFollowUp"
>;

async function loadDatabase() {
	return (await import("@/db")).db;
}

/** Inserts a change, generating its opaque id when the caller does not provide one. */
export async function persistChange(
	input: Omit<ChangeInsert, "id"> & { id?: string },
	database?: Database,
) {
	const db = database ?? (await loadDatabase());
	const [saved] = await db
		.insert(changes)
		.values({ ...input, id: input.id ?? crypto.randomUUID() })
		.returning();
	return saved;
}

/** One vote per CAB member; a later vote replaces the earlier decision atomically. */
export async function persistCabVote(
	input: { memberId: string; vote: CabVote; comment?: string | null },
	capability: CabVoteCapability,
	database?: Database,
) {
	assertCabVoteAuthorized(capability);
	const db = database ?? (await loadDatabase());
	const votedAt = new Date();
	const [saved] = await db
		.insert(changeCabVotes)
		.values({ id: crypto.randomUUID(), ...input, votedAt })
		.onConflictDoUpdate({
			target: changeCabVotes.memberId,
			set: { vote: input.vote, comment: input.comment, votedAt },
		})
		.returning();
	return saved;
}

/** Persists the post-implementation review on the change record itself. */
export async function persistPir(
	changeId: string,
	pir: PirUpdate,
	database?: Database,
) {
	if (!changeId) throw new TypeError("changeId is required");
	const db = database ?? (await loadDatabase());
	const [saved] = await db
		.update(changes)
		.set(pir)
		.where(eq(changes.id, changeId))
		.returning();
	if (!saved) throw new Error(`Change not found: ${changeId}`);
	return saved;
}
