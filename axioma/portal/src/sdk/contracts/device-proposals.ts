// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

import { oc } from "@orpc/contract";
import { z } from "zod";
import { DEVICE_PROPOSAL_STATUSES } from "../shared";
import { id } from "./shared";

/**
 * A command Axel proposed and a person must authorise.
 *
 * `command` is carried verbatim and in full, because the whole point of the gate
 * is that a human reads the exact argument vector before allowing it. Nothing
 * here is truncated for display.
 */
export const deviceProposalSchema = z.object({
	id: z.string(),
	deviceId: z.string(),
	deviceHostname: z.string().nullable(),
	ticketId: z.string(),
	runId: z.string().nullable(),
	command: z.array(z.string()),
	reason: z.string(),
	status: z.enum(DEVICE_PROPOSAL_STATUSES),
	// Both sides of the separation of duty are on the record. The approver may
	// not be the person whose run proposed the command, so the queue has to say
	// who that person was before anyone decides.
	requestedById: z.string().nullable(),
	requestedByName: z.string().nullable(),
	approvedById: z.string().nullable(),
	approvedByName: z.string().nullable(),
	decisionNote: z.string().nullable(),
	decidedAt: z.date().nullable(),
	expiresAt: z.date(),
	createdAt: z.date(),
});

export const deviceProposalsContract = {
	listDeviceProposals: oc.output(z.array(deviceProposalSchema)),
	decideDeviceProposal: oc
		.input(
			z.object({
				id,
				decision: z.enum(["approved", "rejected"]),
				note: z.string().trim().max(2_000).optional(),
			}),
		)
		.output(deviceProposalSchema),
};
