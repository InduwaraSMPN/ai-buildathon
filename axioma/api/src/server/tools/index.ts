import { and, eq, isNotNull, lte } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import {
	agentRuns,
	agentSteps,
	changes,
	changeTransitions,
	tickets,
} from "@/db/schema";
import {
	defaultEnvironmentConnection,
	type EnvironmentConnection,
	type EnvironmentMode,
} from "@/k8s/client";
import { patchImageWithChange } from "./change";
import {
	patchImageInput,
	readDeployment,
	readDeploymentInput,
	readPods,
	readPodsInput,
} from "./cluster";
import {
	cmdbImpact,
	impactInput,
	recordObservation,
	recordObservationInput,
} from "./cmdb";
import {
	deviceActionInput,
	deviceComputerUseInput,
	deviceReadInput,
} from "./device";
import {
	deviceProposeCommandInput,
	proposeDeviceCommand,
} from "./device-proposal";
import {
	knowledgeFetch,
	knowledgeFetchInput,
	knowledgeSearch,
	knowledgeSearchInput,
} from "./knowledge";
import { ticketReadMessages, ticketReadMessagesInput } from "./messages";

/** The authoritative environment a tool call executes against. */
export type ResolvedEnvironment = {
	key: string;
	mode: EnvironmentMode;
	connection: EnvironmentConnection;
};

export type ToolContext = {
	runId: string;
	ticketId: string;
	stepId: string;
	dispatchDevice: (tool: string, input: unknown) => Promise<unknown>;
	/** Resolved run environment, provisioned by the gateway. Absent = bootstrap single-env. */
	environment?: ResolvedEnvironment;
	/** Environment keys linked to the ticket's service. Empty = unrestricted (bootstrap). */
	linkedEnvironments?: ReadonlySet<string>;
};

/**
 * A refusal by the environment contract rather than a failure of the platform.
 * Nothing was attempted, and the message names only the environment and the
 * tool, so there is nothing in it to redact. The gateway tells the two apart by
 * this class instead of by matching on the text.
 */
export class ToolRefusalError extends Error {
	override readonly name = "ToolRefusalError";
}

/**
 * Enforce the environment contract for a tool call. The resolved run
 * environment is authoritative; an agent-named environment must be both linked
 * to the ticket's service and match the resolved one, and a shadow-mode
 * environment refuses any write-effect tool that acts on the environment.
 * Throwing here happens before the cluster/device call so gRPC records the
 * refusal and no side effect occurs.
 *
 * Shadow is a promise about the customer's estate, not about Axioma's own
 * records. A write whose target is `axioma` — the CMDB observation — changes
 * nothing outside this system, and refusing it would make a shadow run
 * impossible to finish at all: recording an observation is the gate every run
 * must pass to resolve, so a blanket refusal left shadow runs exhausting on
 * retries instead of escalating with their diagnosis.
 */
export function assertEnvironmentAllowed(params: {
	name: string;
	effect: "read" | "write";
	target: ToolTarget;
	requested: string | undefined;
	resolved: ResolvedEnvironment;
	linked: ReadonlySet<string>;
}): void {
	const { name, effect, target, requested, resolved, linked } = params;
	if (requested != null) {
		if (linked.size > 0 && !linked.has(requested))
			throw new ToolRefusalError(
				`environment "${requested}" is not linked to the ticket's service`,
			);
		if (requested !== resolved.key)
			throw new ToolRefusalError(
				`run targets environment "${resolved.key}"; refusing to target "${requested}"`,
			);
	}
	if (
		resolved.mode === "shadow" &&
		effect === "write" &&
		target === "environment"
	)
		throw new ToolRefusalError(
			`environment "${resolved.key}" is in shadow mode; refusing write tool "${name}"`,
		);
}

export function sameChangeEnvironment(
	changeEnvironment: string | null | undefined,
	readEnvironment: string,
): boolean {
	return changeEnvironment === readEnvironment;
}

/**
 * Where a tool's effect lands. `environment` reaches the customer's estate —
 * a cluster, a machine, or a command queued for one. `axioma` writes only this
 * system's own records. The distinction exists for shadow mode, which promises
 * that the estate is untouched, and says nothing about Axioma's bookkeeping.
 */
type ToolTarget = "environment" | "axioma";

type ToolHandler = {
	input: z.ZodType;
	effect: "read" | "write";
	target: ToolTarget;
	verifiedBy?: string;
	run(input: never, ctx: ToolContext): Promise<unknown>;
};

const device = (
	input: z.ZodType,
	effect: ToolHandler["effect"],
	verifiedBy?: string,
): ToolHandler => ({
	input,
	effect,
	target: "environment",
	verifiedBy,
	run: (value, ctx) => ctx.dispatchDevice("", value),
});

export const tools: Record<string, ToolHandler> = {
	knowledge_search: {
		input: knowledgeSearchInput,
		effect: "read",
		target: "axioma",
		run: knowledgeSearch,
	},
	knowledge_fetch: {
		input: knowledgeFetchInput,
		effect: "read",
		target: "axioma",
		run: knowledgeFetch,
	},
	ticket_read_messages: {
		input: ticketReadMessagesInput,
		effect: "read",
		target: "axioma",
		run: ticketReadMessages,
	},
	cluster_read_pods: {
		input: readPodsInput,
		effect: "read",
		target: "environment",
		run: readPods,
	},
	cluster_read_deployment: {
		input: readDeploymentInput,
		effect: "read",
		target: "environment",
		run: readDeployment,
	},
	cluster_patch_image: {
		input: patchImageInput,
		effect: "write",
		target: "environment",
		verifiedBy: "cluster_read_deployment",
		run: patchImageWithChange,
	},
	device_read_state: device(deviceReadInput, "read"),
	device_run_action: device(deviceActionInput, "write", "device_read_state"),
	device_computer_use: device(
		deviceComputerUseInput,
		"write",
		"device_read_state",
	),
	// Writes a proposal and returns. Deliberately has no verifier: it changes
	// nothing on the device, so there is nothing for a read to confirm. Its
	// target is still the environment — an approved proposal executes on the
	// machine, so shadow mode must suppress it like any other device write.
	device_propose_command: {
		input: deviceProposeCommandInput,
		effect: "write",
		target: "environment",
		run: (input, ctx) => proposeDeviceCommand(input, ctx),
	},
	cmdb_record_observation: {
		input: recordObservationInput,
		effect: "write",
		target: "axioma",
		run: recordObservation,
	},
	cmdb_impact: {
		input: impactInput,
		effect: "read",
		target: "axioma",
		run: cmdbImpact,
	},
};

/**
 * The write tool that names `read` as the tool confirming it — the inverse of
 * the registry's `verifiedBy`. The registry is static server-side data, so the
 * write named on a verifying step is never a name the model supplied.
 */
export function writeVerifiedBy(read: string): string | undefined {
	return Object.entries(tools).find(
		([, handler]) => handler.verifiedBy === read,
	)?.[0];
}

export async function sweepExpiredChangeVerifications(now = new Date()) {
	return db.transaction(async (tx) => {
		const expired = await tx
			.update(changes)
			.set({
				status: "failed",
				workEndAt: now,
				pirWasSuccessful: false,
				pirActualEndAt: now,
				pirFollowUp: "Post-change verification deadline expired.",
				verificationDeadlineAt: null,
			})
			.where(
				and(
					eq(changes.status, "in_progress"),
					isNotNull(changes.verificationDeadlineAt),
					lte(changes.verificationDeadlineAt, now),
				),
			)
			.returning({ id: changes.id, runId: changes.sourceRunId });
		if (expired.length)
			await tx.insert(changeTransitions).values(
				expired.map(({ id, runId }) => ({
					id: crypto.randomUUID(),
					changeId: id,
					fromStatus: "in_progress" as const,
					toStatus: "failed" as const,
					actorType: "agent" as const,
					actorId: runId,
					runId,
				})),
			);
		return expired.length;
	});
}

export async function executeTool(
	name: string,
	raw: unknown,
	ctx: ToolContext,
) {
	const handler = tools[name];
	if (!handler)
		throw new Error(
			`Unknown tool ${name}. Registered tools: ${Object.keys(tools).join(", ")}`,
		);
	const input = handler.input.parse(raw);
	// The environment this run is pinned to. When the gateway has resolved one it
	// is authoritative; otherwise we fall back to the single-environment
	// bootstrap so an existing deployment keeps working with only KUBECONFIG set.
	const resolved = ctx.environment ?? {
		key: "default",
		mode: "act",
		connection: defaultEnvironmentConnection(),
	};
	const requested = (input as { environment?: string }).environment;
	const linked = ctx.linkedEnvironments ?? new Set<string>();
	assertEnvironmentAllowed({
		name,
		effect: handler.effect,
		target: handler.target,
		requested,
		resolved,
		linked,
	});
	const pending =
		name === "cluster_read_deployment"
			? (
					await db
						.select({
							id: changes.id,
							environmentKey: agentRuns.environmentKey,
						})
						.from(changes)
						.innerJoin(agentRuns, eq(changes.sourceRunId, agentRuns.id))
						.where(
							and(
								eq(changes.sourceRunId, ctx.runId),
								eq(changes.status, "in_progress"),
								isNotNull(changes.verificationDeadlineAt),
							),
						)
						.limit(1)
				)[0]
			: undefined;
	const verifies = Boolean(pending);
	// A verification read may only discharge a change created in the same
	// environment; refusing here keeps a cross-cluster read from completing it.
	if (pending && !sameChangeEnvironment(pending.environmentKey, resolved.key))
		throw new Error(
			`cannot verify change "${pending.id}" (environment "${pending.environmentKey ?? "unknown"}") with a read against "${resolved.key}"`,
		);
	const marker = verifies
		? "verifying_fix"
		: name === "cluster_patch_image" ||
				name.startsWith("device_run_") ||
				name === "device_computer_use"
			? "applying_fix"
			: name.startsWith("cluster_read_")
				? "checking_service"
				: name === "device_read_state"
					? "checking_device"
					: null;
	if (marker)
		await db
			.update(tickets)
			.set({ progressMarker: marker })
			.where(eq(tickets.id, ctx.ticketId));
	const output = await handler.run(input as never, {
		...ctx,
		environment: resolved,
		dispatchDevice: (_ignored, value) => ctx.dispatchDevice(name, value),
	});
	if (verifies) {
		const changeId = pending?.id;
		if (changeId) {
			const completedAt = new Date();
			await db.transaction(async (tx) => {
				const [completed] = await tx
					.update(changes)
					.set({
						status: "completed",
						workEndAt: completedAt,
						pirWasSuccessful: true,
						pirActualEndAt: completedAt,
						pirReview: JSON.stringify(output),
						pirLessonsLearned: "Explicit post-change verification succeeded.",
						verificationDeadlineAt: null,
					})
					.where(
						and(eq(changes.id, changeId), eq(changes.status, "in_progress")),
					)
					.returning({ id: changes.id });
				if (!completed) return;
				await tx.insert(changeTransitions).values({
					id: crypto.randomUUID(),
					changeId,
					fromStatus: "in_progress",
					toStatus: "completed",
					actorType: "agent",
					actorId: ctx.runId,
					runId: ctx.runId,
					stepId: ctx.stepId,
				});
				// Stamped in the transaction that discharges the obligation, so the
				// transcript can only call a read a verification when that read is
				// what actually completed the change. A second read of the same
				// deployment finds nothing in progress and stays unmarked, which is
				// what makes the marked step worth pointing at.
				await tx
					.update(agentSteps)
					.set({ verifiesTool: writeVerifiedBy(name) })
					.where(eq(agentSteps.id, ctx.stepId));
			});
		}
	}
	return output;
}
