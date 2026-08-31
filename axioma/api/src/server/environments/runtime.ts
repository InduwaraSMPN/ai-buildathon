import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
	agentRuns,
	cmdbObjectEnvironments,
	cmdbObjects,
	environments,
	serviceEnvironments,
	ticketCmdbObjects,
	ticketEnvironments,
	tickets,
} from "@/db/schema";
import type { EnvironmentSource } from "@/db/schema/environments";
import type { EnvironmentConnection, EnvironmentMode } from "@/k8s/client";
import { resolveEnvironment } from "./resolve";

export const BOOTSTRAP_ENVIRONMENT_KEY = "default";

export type ResolvedRunEnvironment = {
	environmentId: string | null;
	environmentKey: string | null;
	environmentSource: EnvironmentSource | null;
};

/**
 * Resolves the environment a run should execute against, before the run starts.
 *
 * Gathers the four inputs the pure resolver needs (the ticket's structured
 * environment linkage, the service allow-list, the affected CI's CMDB
 * environment, and the configured default) and records how it was chosen so the
 * run list can show provenance. When no environment rows exist it falls back to
 * the single bootstrap environment (`key = "default"`, no FK row) so an existing
 * KUBECONFIG-only deployment keeps working unchanged.
 */
export async function resolveRunEnvironment(ticket: {
	id: string;
	serviceId: string;
}): Promise<ResolvedRunEnvironment> {
	const [ticketLink, serviceAllowlist, cmdbEnv, defaultEnv] = await Promise.all(
		[
			db
				.select({ environmentId: ticketEnvironments.environmentId })
				.from(ticketEnvironments)
				.where(eq(ticketEnvironments.ticketId, ticket.id))
				.limit(1),
			db
				.select({ environmentId: serviceEnvironments.environmentId })
				.from(serviceEnvironments)
				.where(eq(serviceEnvironments.serviceId, ticket.serviceId)),
			// The environment of the affected CI linked to the ticket.
			db
				.select({ environmentId: cmdbObjectEnvironments.environmentId })
				.from(ticketCmdbObjects)
				.innerJoin(cmdbObjects, eq(cmdbObjects.id, ticketCmdbObjects.objectId))
				.innerJoin(
					cmdbObjectEnvironments,
					eq(cmdbObjectEnvironments.objectId, cmdbObjects.id),
				)
				.where(eq(ticketCmdbObjects.ticketId, ticket.id))
				.limit(1),
			db
				.select({ id: environments.id })
				.from(environments)
				.where(eq(environments.isDefault, true))
				.limit(1),
		],
	);

	if (!ticketLink[0] && !cmdbEnv[0] && !defaultEnv[0])
		return {
			environmentId: null,
			environmentKey: BOOTSTRAP_ENVIRONMENT_KEY,
			environmentSource: "default",
		};

	const resolved = resolveEnvironment({
		ticket: {
			serviceId: ticket.serviceId,
			environmentId: ticketLink[0]?.environmentId,
		},
		serviceEnvironmentIds: serviceAllowlist.map((row) => row.environmentId),
		cmdbEnvironmentId: cmdbEnv[0]?.environmentId,
		defaultEnvironmentId: defaultEnv[0]?.id,
	});
	const resolvedRow = await db
		.select({ key: environments.key })
		.from(environments)
		.where(eq(environments.id, resolved.environmentId))
		.limit(1);
	if (!resolvedRow[0])
		throw new Error(`resolved environment ${resolved.environmentId} not found`);
	return {
		environmentId: resolved.environmentId,
		environmentKey: resolvedRow[0].key,
		environmentSource: resolved.source,
	};
}

export type RunEnvironment = {
	/** Resolved run environment; absent means the single-environment bootstrap. */
	environment?: {
		key: string;
		mode: EnvironmentMode;
		connection: EnvironmentConnection;
	};
	/** Environment keys a tool may name. Empty = unrestricted (bootstrap). */
	linkedEnvironments: ReadonlySet<string>;
};

/**
 * Loads the connection a tool call should execute against from the run's
 * persisted environment, plus the environment keys the ticket's service may
 * target. An unresolved run (or a deleted environment) returns an absent
 * environment so `executeTool` falls back to the single-environment bootstrap.
 */
export async function loadRunEnvironment(
	runId: string,
): Promise<RunEnvironment> {
	const run = (
		await db
			.select({
				environmentId: agentRuns.environmentId,
				ticketId: agentRuns.ticketId,
			})
			.from(agentRuns)
			.where(eq(agentRuns.id, runId))
			.limit(1)
	)[0];
	if (!run) return { linkedEnvironments: new Set() };

	const ticket = (
		await db
			.select({ serviceId: tickets.serviceId })
			.from(tickets)
			.where(eq(tickets.id, run.ticketId))
			.limit(1)
	)[0];
	const linkedRows = ticket
		? await db
				.select({ key: environments.key })
				.from(serviceEnvironments)
				.innerJoin(
					environments,
					eq(environments.id, serviceEnvironments.environmentId),
				)
				.where(eq(serviceEnvironments.serviceId, ticket.serviceId))
		: [];

	if (!run.environmentId) {
		return { environment: undefined, linkedEnvironments: new Set() };
	}
	const env = (
		await db
			.select()
			.from(environments)
			.where(eq(environments.id, run.environmentId))
			.limit(1)
	)[0];
	if (!env) return { environment: undefined, linkedEnvironments: new Set() };

	const connection: EnvironmentConnection = {
		id: env.id,
		key: env.key,
		connectionType: env.connectionType,
		...(env.contextName ? { contextName: env.contextName } : {}),
		...(env.credentialEncrypted
			? { credentialEncrypted: env.credentialEncrypted }
			: {}),
	};
	// Favour the run's resolved environment so reads/writes always target this
	// run's cluster; the service links broaden what a tool may still name.
	const linkedEnvironments = new Set<string>([
		...linkedRows.map((row) => row.key),
		env.key,
	]);
	return {
		environment: { key: env.key, mode: env.mode, connection },
		linkedEnvironments,
	};
}
