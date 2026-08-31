import { and, eq, isNotNull, lte } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { agentRuns, changes, changeTransitions, tickets } from "@/db/schema";
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
 * Enforce the environment contract for a tool call. The resolved run
 * environment is authoritative; an agent-named environment must be both linked
 * to the ticket's service and match the resolved one, and a shadow-mode
 * environment refuses any write-effect tool. Throwing here happens before the
 * cluster/device call so gRPC records the refusal and no side effect occurs.
 */
export function assertEnvironmentAllowed(params: {
	name: string;
	effect: "read" | "write";
	requested: string | undefined;
	resolved: ResolvedEnvironment;
	linked: ReadonlySet<string>;
}): void {
	const { name, effect, requested, resolved, linked } = params;
	if (requested != null) {
		if (linked.size > 0 && !linked.has(requested))
			throw new Error(
				`environment "${requested}" is not linked to the ticket's service`,
			);
		if (requested !== resolved.key)
			throw new Error(
				`run targets environment "${resolved.key}"; refusing to target "${requested}"`,
			);
	}
	if (resolved.mode === "shadow" && effect === "write")
		throw new Error(
			`environment "${resolved.key}" is in shadow mode; refusing write tool "${name}"`,
		);
}

/** A verification read completes a change only in its persisted run environment. */
export function sameChangeEnvironment(
	changeEnvironment: string | null | undefined,
	readEnvironment: string,
): boolean {
	return changeEnvironment === readEnvironment;
}

type ToolHandler = {
	input: z.ZodType;
	effect: "read" | "write";
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
	verifiedBy,
	run: (value, ctx) => ctx.dispatchDevice("", value),
});

export const tools: Record<string, ToolHandler> = {
	knowledge_search: {
		input: knowledgeSearchInput,
		effect: "read",
		run: knowledgeSearch,
	},
	knowledge_fetch: {
		input: knowledgeFetchInput,
		effect: "read",
		run: knowledgeFetch,
	},
	ticket_read_messages: {
		input: ticketReadMessagesInput,
		effect: "read",
		run: ticketReadMessages,
	},
	cluster_read_pods: { input: readPodsInput, effect: "read", run: readPods },
	cluster_read_deployment: {
		input: readDeploymentInput,
		effect: "read",
		run: readDeployment,
	},
	cluster_patch_image: {
		input: patchImageInput,
		effect: "write",
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
	// nothing on the device, so there is nothing for a read to confirm.
	device_propose_command: {
		input: deviceProposeCommandInput,
		effect: "write",
		run: (input, ctx) => proposeDeviceCommand(input, ctx),
	},
	cmdb_record_observation: {
		input: recordObservationInput,
		effect: "write",
		run: recordObservation,
	},
	cmdb_impact: { input: impactInput, effect: "read", run: cmdbImpact },
};

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
			});
		}
	}
	return output;
}
