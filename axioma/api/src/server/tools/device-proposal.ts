import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { agentRuns, deviceCommandProposals, devices } from "@/db/schema";

/**
 * How long an undecided proposal stands. Stale authorisation is not
 * authorisation, and a proposal nobody looked at within a working day is
 * describing a machine state that has moved on.
 */
export const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;

/** An argument vector, never a command line. No shell is involved anywhere. */
const argv = z
	.array(z.string().min(1).max(1024))
	.min(1)
	.max(32)
	.refine((parts) => parts.every((part) => !/[\r\n\0]/.test(part)), {
		message: "an argument may not contain a control character",
	});

export const deviceProposeCommandInput = z.object({
	device_id: z.string().min(1),
	command: argv,
	// Written for the person who has to decide, not for the transcript.
	reason: z.string().min(20).max(2000),
});

/**
 * The digest binds an approval to one exact argument vector. Dispatch recomputes
 * it from the stored command and refuses on a mismatch, so a proposal edited
 * after approval cannot ride the old decision.
 */
export function commandDigest(command: readonly string[]) {
	return createHash("sha256").update(JSON.stringify(command)).digest("hex");
}

/**
 * Axel proposes; it does not execute. This writes a row and returns — the run
 * then escalates, because a run holds a lease measured in seconds and a person
 * decides in hours. Nothing here reaches a device.
 */
export async function proposeDeviceCommand(
	input: z.infer<typeof deviceProposeCommandInput>,
	ctx: { ticketId: string; runId: string; stepId: string },
) {
	const [device] = await db
		.select({ id: devices.id, executionEnabled: devices.executionEnabled })
		.from(devices)
		.where(eq(devices.id, input.device_id))
		.limit(1);
	if (!device) throw new Error(`Unknown device ${input.device_id}`);
	if (!device.executionEnabled)
		throw new Error(
			`Device ${input.device_id} does not allow proposed commands. General execution is off unless an operator turns it on.`,
		);

	// Copy the run's initiator onto the proposal so the separation-of-duty check
	// survives the run row being deleted, and so approval needs one read.
	let requestedById: string | null = null;
	if (ctx.runId) {
		const [run] = await db
			.select({ startedById: agentRuns.startedById })
			.from(agentRuns)
			.where(eq(agentRuns.id, ctx.runId))
			.limit(1);
		requestedById = run?.startedById ?? null;
	}

	const id = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + PROPOSAL_TTL_MS);
	await db.insert(deviceCommandProposals).values({
		id,
		deviceId: input.device_id,
		ticketId: ctx.ticketId,
		runId: ctx.runId || null,
		stepId: ctx.stepId || null,
		command: input.command,
		digest: commandDigest(input.command),
		reason: input.reason,
		requestedById,
		expiresAt,
	});
	return {
		proposal_id: id,
		status: "proposed" as const,
		expires_at: expiresAt.toISOString(),
		note: "Awaiting a human decision. Nothing has run. Escalate this ticket with your diagnosis; the command runs only if someone approves it.",
	};
}

export type DispatchableProposal = {
	id: string;
	deviceId: string;
	command: string[];
};

/**
 * Every reason a proposal may not run, in one place, checked before anything is
 * dispatched. Mirrors assertStandardImageChange: a pure assertion that throws
 * before a side effect rather than a check buried in the dispatch path.
 */
export function assertProposalDispatchable(proposal: {
	status: string;
	expiresAt: Date;
	approvedById: string | null;
	command: unknown;
	digest: string;
	executionEnabled: boolean;
	dispatchedCommandId: string | null;
}): asserts proposal is typeof proposal & { command: string[] } {
	if (proposal.status === "dispatched" || proposal.dispatchedCommandId)
		throw new Error(
			"This proposal has already run. An approval authorises one execution.",
		);
	if (proposal.status === "rejected")
		throw new Error("This proposal was rejected.");
	if (proposal.status === "expired")
		throw new Error("This proposal expired before it was decided.");
	if (proposal.status !== "approved" || !proposal.approvedById)
		throw new Error("This proposal has not been approved.");
	if (proposal.expiresAt.getTime() <= Date.now())
		throw new Error("This proposal expired before it was dispatched.");
	if (!proposal.executionEnabled)
		throw new Error("This device no longer allows proposed commands.");
	const command = proposal.command;
	if (
		!Array.isArray(command) ||
		!command.length ||
		!command.every((p) => typeof p === "string")
	)
		throw new Error("This proposal does not carry an argument vector.");
	if (commandDigest(command as string[]) !== proposal.digest)
		throw new Error(
			"The command changed after it was approved. The approval no longer applies.",
		);
}

/**
 * Consume the approval, before anything is sent. The `status = 'approved'`
 * predicate is the enforcement — if a concurrent dispatch got there first this
 * matches zero rows and the caller is told, rather than two executions racing on
 * one decision. Claiming first means a lost race sends nothing, which is the
 * right way round to fail.
 *
 * The command id is not recorded here because it does not exist yet: the row is
 * created during dispatch. The link runs the other way, from
 * `device_commands.proposal_id`, which is also the column that answers who
 * authorised a command.
 */
export async function consumeProposal(id: string) {
	const [claimed] = await db
		.update(deviceCommandProposals)
		.set({ status: "dispatched" })
		.where(
			and(
				eq(deviceCommandProposals.id, id),
				eq(deviceCommandProposals.status, "approved"),
			),
		)
		.returning({ id: deviceCommandProposals.id });
	return Boolean(claimed);
}
