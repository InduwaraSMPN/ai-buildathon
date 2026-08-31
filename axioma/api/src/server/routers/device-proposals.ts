import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { deviceCommandProposals, devices } from "@/db/schema";
import { grpcGateway } from "../grpc";
import { capabilityProcedure } from "../orpc";
import {
	assertProposalDispatchable,
	consumeProposal,
} from "../tools/device-proposal";

const asCommand = (value: unknown) =>
	Array.isArray(value) ? value.map(String) : [];

/**
 * An undecided proposal goes stale rather than waiting indefinitely, and it is
 * swept on read so a queue never shows something that can no longer be run.
 */
export async function expireStaleProposals(now = new Date()) {
	await db
		.update(deviceCommandProposals)
		.set({ status: "expired" })
		.where(
			and(
				inArray(deviceCommandProposals.status, ["proposed", "approved"]),
				lt(deviceCommandProposals.expiresAt, now),
			),
		);
}

export const deviceProposalsRouter = {
	listDeviceProposals: capabilityProcedure(
		"device.approve",
	).listDeviceProposals.handler(async () => {
		await expireStaleProposals();
		const rows = await db
			.select({
				id: deviceCommandProposals.id,
				deviceId: deviceCommandProposals.deviceId,
				deviceHostname: devices.hostname,
				ticketId: deviceCommandProposals.ticketId,
				runId: deviceCommandProposals.runId,
				command: deviceCommandProposals.command,
				reason: deviceCommandProposals.reason,
				status: deviceCommandProposals.status,
				approvedById: deviceCommandProposals.approvedById,
				decisionNote: deviceCommandProposals.decisionNote,
				decidedAt: deviceCommandProposals.decidedAt,
				expiresAt: deviceCommandProposals.expiresAt,
				createdAt: deviceCommandProposals.createdAt,
			})
			.from(deviceCommandProposals)
			.leftJoin(devices, eq(deviceCommandProposals.deviceId, devices.id))
			.orderBy(desc(deviceCommandProposals.createdAt))
			.limit(200);
		return rows.map((row) => ({ ...row, command: asCommand(row.command) }));
	}),

	decideDeviceProposal: capabilityProcedure(
		"device.approve",
	).decideDeviceProposal.handler(async ({ context, input }) => {
		await expireStaleProposals();
		// The status predicate is the concurrency control: a second decider
		// matches zero rows and is told, rather than overwriting a decision.
		const [decided] = await db
			.update(deviceCommandProposals)
			.set({
				status: input.decision,
				approvedById: context.userId,
				decisionNote: input.note,
				decidedAt: new Date(),
			})
			.where(
				and(
					eq(deviceCommandProposals.id, input.id),
					eq(deviceCommandProposals.status, "proposed"),
				),
			)
			.returning();
		if (!decided)
			throw new ORPCError("CONFLICT", {
				message: "Proposal is missing, already decided, or expired",
			});
		// Whoever set the run going does not get to authorise what it proposed.
		// The capability separation already keeps analysts out; this closes the
		// case where one person holds both roles.
		if (decided.requestedById && decided.requestedById === context.userId) {
			await db
				.update(deviceCommandProposals)
				.set({ status: "proposed", approvedById: null, decidedAt: null })
				.where(eq(deviceCommandProposals.id, decided.id));
			throw new ORPCError("FORBIDDEN", {
				message:
					"You started the run that proposed this command; someone else must decide it",
			});
		}

		const [device] = await db
			.select({
				hostname: devices.hostname,
				executionEnabled: devices.executionEnabled,
			})
			.from(devices)
			.where(eq(devices.id, decided.deviceId))
			.limit(1);

		const result = {
			...decided,
			command: asCommand(decided.command),
			deviceHostname: device?.hostname ?? null,
		};
		if (input.decision !== "approved") return result;

		// Everything that could refuse this is checked before anything is sent.
		assertProposalDispatchable({
			status: decided.status,
			expiresAt: decided.expiresAt,
			approvedById: decided.approvedById,
			command: decided.command,
			digest: decided.digest,
			executionEnabled: Boolean(device?.executionEnabled),
			dispatchedCommandId: decided.dispatchedCommandId,
		});
		// Claim the approval before dispatching. A lost race sends nothing.
		if (!(await consumeProposal(decided.id)))
			throw new ORPCError("CONFLICT", {
				message: "Proposal was already dispatched",
			});
		// Detached: the device may take a minute, and the approver should not
		// wait on it. The outcome lands on the command row and the transcript.
		void grpcGateway
			.dispatchDeviceTool(
				"",
				"device_run_command",
				{
					device_id: decided.deviceId,
					command: result.command,
					proposal_id: decided.id,
				},
				undefined,
				decided.id,
			)
			.catch((error) =>
				console.error("[proposals] approved command failed", error),
			);
		return { ...result, status: "dispatched" as const };
	}),
};
