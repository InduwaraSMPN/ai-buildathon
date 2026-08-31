import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { aesGcmEncryptSecret } from "@/auth/providers";
import { db } from "@/db";
import {
	environments,
	serviceEnvironments,
	services,
	ticketEnvironments,
	tickets,
} from "@/db/schema";
import { env } from "@/env";
import { evictKubernetesClients } from "@/k8s/client";
import { capabilityProcedure } from "../orpc";

const environmentColumns = {
	id: environments.id,
	key: environments.key,
	label: environments.label,
	connectionType: environments.connectionType,
	contextName: environments.contextName,
	mode: environments.mode,
	isDefault: environments.isDefault,
	// Present without ever revealing the encrypted or plaintext value.
	hasCredential: sql<boolean>`${environments.credentialEncrypted} is not null`,
	createdAt: environments.createdAt,
	updatedAt: environments.updatedAt,
};

const encryptEnvironmentCredential =
	env.AXIOMA_PROVIDER_ENCRYPTION_KEY === undefined
		? null
		: aesGcmEncryptSecret(env.AXIOMA_PROVIDER_ENCRYPTION_KEY);

function encryptCredential(credential: string): string {
	if (!encryptEnvironmentCredential)
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message:
				"AXIOMA_PROVIDER_ENCRYPTION_KEY is not configured; cannot store credentials",
		});
	return encryptEnvironmentCredential(credential);
}

async function assertValidServiceIds(serviceIds: readonly string[]) {
	const ids = [...new Set(serviceIds)];
	if (!ids.length) return;
	const found = await db
		.select({ id: services.id })
		.from(services)
		.where(inArray(services.id, ids));
	if (found.length !== ids.length)
		throw new ORPCError("BAD_REQUEST", {
			message: "unknown service id in list",
		});
}

async function serviceIdsFor(environmentId: string): Promise<string[]> {
	const rows = await db
		.select({ serviceId: serviceEnvironments.serviceId })
		.from(serviceEnvironments)
		.where(eq(serviceEnvironments.environmentId, environmentId));
	return rows.map((row) => row.serviceId).sort();
}

async function getEnvironment(environmentId: string) {
	const [row] = await db
		.select(environmentColumns)
		.from(environments)
		.where(eq(environments.id, environmentId))
		.limit(1);
	if (!row) return;
	return { ...row, serviceIds: await serviceIdsFor(environmentId) };
}

export const environmentsRouter = {
	listEnvironments: capabilityProcedure(
		"admin.environments",
	).listEnvironments.handler(async () => {
		const rows = await db
			.select(environmentColumns)
			.from(environments)
			.orderBy(asc(environments.key));
		return Promise.all(
			rows.map(async (row) => ({
				...row,
				serviceIds: await serviceIdsFor(row.id),
			})),
		);
	}),
	createEnvironment: capabilityProcedure(
		"admin.environments",
	).createEnvironment.handler(async ({ input }) => {
		await assertValidServiceIds(input.serviceIds);
		const id = crypto.randomUUID();
		await db.transaction(async (tx) => {
			if (input.isDefault)
				await tx
					.update(environments)
					.set({ isDefault: false })
					.where(eq(environments.isDefault, true));
			await tx.insert(environments).values({
				id,
				key: input.key,
				label: input.label,
				connectionType: input.connectionType,
				contextName: input.contextName ?? null,
				credentialEncrypted: input.credential
					? encryptCredential(input.credential)
					: null,
				mode: input.mode,
				isDefault: input.isDefault,
			});
			if (input.serviceIds.length)
				await tx.insert(serviceEnvironments).values(
					input.serviceIds.map((serviceId) => ({
						serviceId,
						environmentId: id,
					})),
				);
		});
		const row = await getEnvironment(id);
		if (!row) throw new Error("environment insert failed");
		return row;
	}),
	updateEnvironment: capabilityProcedure(
		"admin.environments",
	).updateEnvironment.handler(async ({ input }) => {
		if (input.serviceIds !== undefined)
			await assertValidServiceIds(input.serviceIds);
		await db.transaction(async (tx) => {
			const [existing] = await tx
				.select({ id: environments.id })
				.from(environments)
				.where(eq(environments.id, input.id))
				.limit(1);
			if (!existing) throw new ORPCError("NOT_FOUND");

			if (input.isDefault)
				await tx
					.update(environments)
					.set({ isDefault: false })
					.where(
						and(
							eq(environments.isDefault, true),
							ne(environments.id, input.id),
						),
					);

			const patch: Partial<typeof environments.$inferSelect> = {};
			if (input.key !== undefined) patch.key = input.key;
			if (input.label !== undefined) patch.label = input.label;
			if (input.connectionType !== undefined)
				patch.connectionType = input.connectionType;
			if (input.contextName !== undefined)
				patch.contextName = input.contextName;
			if (input.mode !== undefined) patch.mode = input.mode;
			if (input.isDefault !== undefined) patch.isDefault = input.isDefault;
			if (input.credential !== undefined)
				patch.credentialEncrypted = encryptCredential(input.credential);

			await tx
				.update(environments)
				.set(patch)
				.where(eq(environments.id, input.id));

			if (input.serviceIds !== undefined) {
				await tx
					.delete(serviceEnvironments)
					.where(eq(serviceEnvironments.environmentId, input.id));
				if (input.serviceIds.length)
					await tx.insert(serviceEnvironments).values(
						input.serviceIds.map((serviceId) => ({
							serviceId,
							environmentId: input.id,
						})),
					);
			}
		});
		// Drop any cached cluster client so the next use rebuilds from the new row.
		evictKubernetesClients(input.id);
		const row = await getEnvironment(input.id);
		if (!row) throw new ORPCError("NOT_FOUND");
		return row;
	}),
	deleteEnvironment: capabilityProcedure(
		"admin.environments",
	).deleteEnvironment.handler(async ({ input }) => {
		const deleted = Boolean(
			(
				await db
					.delete(environments)
					.where(eq(environments.id, input.id))
					.returning({ id: environments.id })
			)[0],
		);
		// No cached client should survive a deleted environment.
		if (deleted) evictKubernetesClients(input.id);
		return { deleted };
	}),
	linkTicketEnvironment: capabilityProcedure(
		"admin.environments",
	).linkTicketEnvironment.handler(async ({ input }) => {
		const [ticket] = await db
			.select({ serviceId: tickets.serviceId })
			.from(tickets)
			.where(eq(tickets.id, input.ticketId))
			.limit(1);
		if (!ticket)
			throw new ORPCError("NOT_FOUND", { message: "ticket not found" });

		const [link] = await db
			.select({ environmentId: serviceEnvironments.environmentId })
			.from(serviceEnvironments)
			.where(
				and(
					eq(serviceEnvironments.serviceId, ticket.serviceId),
					eq(serviceEnvironments.environmentId, input.environmentId),
				),
			)
			.limit(1);
		if (!link)
			throw new ORPCError("BAD_REQUEST", {
				message: `environment ${input.environmentId} is not linked to service ${ticket.serviceId}`,
			});

		await db
			.insert(ticketEnvironments)
			.values({
				ticketId: input.ticketId,
				environmentId: input.environmentId,
			})
			.onConflictDoUpdate({
				target: ticketEnvironments.ticketId,
				set: { environmentId: input.environmentId },
			});
		return { linked: true as const };
	}),
	unlinkTicketEnvironment: capabilityProcedure(
		"admin.environments",
	).unlinkTicketEnvironment.handler(async ({ input }) => ({
		deleted: Boolean(
			(
				await db
					.delete(ticketEnvironments)
					.where(
						and(
							eq(ticketEnvironments.ticketId, input.ticketId),
							eq(ticketEnvironments.environmentId, input.environmentId),
						),
					)
					.returning({ ticketId: ticketEnvironments.ticketId })
			)[0],
		),
	})),
};
