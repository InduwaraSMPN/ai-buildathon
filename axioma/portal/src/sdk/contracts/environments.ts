// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Environment output. Credentials are never included: the encrypted column stays
 * server-side and the plaintext input is never returned. `serviceIds` reports the
 * service×environment associations edited via create/update.
 */
const environment = z.object({
	id: z.string(),
	key: z.string(),
	label: z.string(),
	connectionType: z.enum(["in_cluster", "kubeconfig"]),
	contextName: z.string().nullable(),
	mode: z.enum(["act", "shadow"]),
	isDefault: z.boolean(),
	serviceIds: z.array(z.string()),
	// Whether a credential is stored; never the credential itself.
	hasCredential: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const environmentInput = z.object({
	key: z.string().trim().min(1).max(80),
	label: z.string().trim().min(1).max(160),
	connectionType: z.enum(["in_cluster", "kubeconfig"]),
	contextName: z.string().trim().min(1).nullable().optional(),
	credential: z.string().trim().min(1).optional(),
	mode: z.enum(["act", "shadow"]).default("act"),
	isDefault: z.boolean().default(false),
	serviceIds: z.array(z.string().trim().min(1)).default([]),
});

export const environmentsContract = {
	listEnvironments: oc.output(z.array(environment)),
	createEnvironment: oc.input(environmentInput).output(environment),
	updateEnvironment: oc
		.input(
			z.object({
				id: z.string().min(1),
				key: z.string().trim().min(1).max(80).optional(),
				label: z.string().trim().min(1).max(160).optional(),
				connectionType: z.enum(["in_cluster", "kubeconfig"]).optional(),
				contextName: z.string().trim().min(1).nullable().optional(),
				credential: z.string().trim().min(1).optional(),
				mode: z.enum(["act", "shadow"]).optional(),
				isDefault: z.boolean().optional(),
				serviceIds: z.array(z.string().trim().min(1)).optional(),
			}),
		)
		.output(environment),
	deleteEnvironment: oc
		.input(z.object({ id: z.string() }))
		.output(z.object({ deleted: z.boolean() })),
	linkTicketEnvironment: oc
		.input(
			z.object({
				ticketId: z.string().min(1),
				environmentId: z.string().min(1),
			}),
		)
		.output(z.object({ linked: z.literal(true) })),
	unlinkTicketEnvironment: oc
		.input(
			z.object({
				ticketId: z.string().min(1),
				environmentId: z.string().min(1),
			}),
		)
		.output(z.object({ deleted: z.boolean() })),
};
