// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

import { oc } from "@orpc/contract";
import { z } from "zod";
import { capability } from "./shared";

const directoryPerson = z.object({
	externalId: z.string().trim().min(1),
	email: z.string().trim().toLowerCase().pipe(z.email()),
	name: z.string().min(1),
	jobTitle: z.string().nullable(),
	department: z.string().nullable(),
	managerExternalId: z.string().nullable(),
});

const directoryChange = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("create"), person: directoryPerson }),
	z.object({
		kind: z.literal("update"),
		userId: z.string(),
		person: directoryPerson,
	}),
	z.object({
		kind: z.literal("mark_leaver"),
		userId: z.string(),
		externalId: z.string(),
	}),
]);

const directoryPlan = z.object({
	previousCount: z.number().int().nonnegative(),
	foundCount: z.number().int().nonnegative(),
	createdCount: z.number().int().nonnegative(),
	updatedCount: z.number().int().nonnegative(),
	leaverCount: z.number().int().nonnegative(),
	changes: z.array(directoryChange),
});

const team = z.object({
	id: z.string(),
	name: z.string(),
	memberIds: z.array(z.string()),
	roleIds: z.array(z.string()),
});

const role = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	capabilities: z.array(capability),
});

export const identityContract = {
	privateData: oc.output(
		z.object({
			message: z.string(),
			user: z
				.object({
					id: z.string(),
					name: z.string(),
					email: z.string(),
					kind: z.enum(["staff", "reporter"]),
				})
				.nullish(),
			capabilities: z.array(capability),
		}),
	),
	listRoles: oc.output(z.array(role)),
	getRole: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(role.nullable()),
	updateRoleCapabilities: oc
		.input(
			z.object({
				roleId: z.string().min(1),
				capabilities: z.array(capability),
			}),
		)
		.output(role),
	assignRole: oc
		.input(
			z.object({
				roleId: z.string().min(1),
				targetType: z.enum(["user", "team"]),
				targetId: z.string().min(1),
				assigned: z.boolean(),
			}),
		)
		.output(z.object({ assigned: z.boolean() })),
	listTeams: oc.output(z.array(team)),
	updateTeam: oc
		.input(
			z.object({
				id: z.string().min(1),
				name: z.string().trim().min(1).max(160),
				memberIds: z.array(z.string().min(1)),
				roleIds: z.array(z.string().min(1)),
			}),
		)
		.output(team),
	listAuthProviders: oc.output(
		z.array(z.object({ providerId: z.string(), name: z.string() })),
	),
	previewDirectorySync: oc
		.input(z.object({ providerId: z.string().min(1) }))
		.output(directoryPlan),
	applyDirectorySync: oc
		.input(z.object({ providerId: z.string().min(1) }))
		.output(directoryPlan),
};
