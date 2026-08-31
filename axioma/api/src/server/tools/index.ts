import { and, eq, isNotNull, lte } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { changes, changeTransitions, tickets } from "@/db/schema";
import {
	defaultEnvironmentConnection,
	type EnvironmentConnection,
	type EnvironmentMode,
} from "@/k8s/client";
import { changeEnvironment, patchImageWithChange } from "./change";
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

// Tool names whose effect is a write. Shadow-mode environments refuse these
// before any cluster/device call so the transcript still records the attempt.
const WRITE_EFFECT_TOOLS = new Set([
	"cluster_patch_image",
	"device_run_action",
	"device_computer_use",
	"cmdb_record_observation",
	// A proposal touches no device, so listing it here is a judgement rather
	// than an obvious call. It is listed deliberately: approval dispatches
	// through an oRPC route that never sees the run's environment, so a shadow
	// run could otherwise propose a command that a later approval executes for
	// real. Refusing at proposal time is the only point where the environment
	// is still known.
	"device_propose_command",
]);

/**
 * Enforce the environment contract for a tool call. The resolved run
 * environment is authoritative; an agent-named environment must be both linked
 * to the ticket's service and match the resolved one, and a shadow-mode
 * environment refuses any write-effect tool. Throwing here happens before the
 * cluster/device call so gRPC records the refusal and no side effect occurs.
 */
export function assertEnvironmentAllowed(params: {
	name: string;
	requested: string | undefined;
	resolved: ResolvedEnvironment;
	linked: ReadonlySet<string>;
}): void {
	const { name, requested, resolved, linked } = params;
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
	if (resolved.mode === "shadow" && WRITE_EFFECT_TOOLS.has(name))
		throw new Error(
			`environment "${resolved.key}" is in shadow mode; refusing write tool "${name}"`,
		);
}

/**
 * A post-change verification read may complete a change only when it observes the
 * same environment the change was applied to. An unknown environment (e.g. after
 * a gateway restart) is tolerated so existing change completion keeps working.
 */
export function sameChangeEnvironment(
	changeEnvironment: string | undefined,
	readEnvironment: string,
): boolean {
	return (
		changeEnvironment === undefined || changeEnvironment === readEnvironment
	);
}

type ToolHandler = {
	input: z.ZodType;
	verifiedBy?: string;
	run(input: never, ctx: ToolContext): Promise<unknown>;
};

const device = (input: z.ZodType, verifiedBy?: string): ToolHandler => ({
	input,
	verifiedBy,
	run: (value, ctx) => ctx.dispatchDevice("", value),
});

export const tools: Record<string, ToolHandler> = {
	knowledge_search: { input: knowledgeSearchInput, run: knowledgeSearch },
	knowledge_fetch: { input: knowledgeFetchInput, run: knowledgeFetch },
	ticket_read_messages: {
		input: ticketReadMessagesInput,
		run: ticketReadMessages,
	},
	cluster_read_pods: { input: readPodsInput, run: readPods },
	cluster_read_deployment: {
		input: readDeploymentInput,
		run: readDeployment,
	},
	cluster_patch_image: {
		input: patchImageInput,
		verifiedBy: "cluster_read_deployment",
		run: patchImageWithChange,
	},
	device_read_state: device(deviceReadInput),
	device_run_action: device(deviceActionInput, "device_read_state"),
	device_computer_use: device(deviceComputerUseInput, "device_read_state"),
	// Writes a proposal and returns. Deliberately has no verifier: it changes
	// nothing on the device, so there is nothing for a read to confirm.
	device_propose_command: {
		input: deviceProposeCommandInput,
		run: (input, ctx) => proposeDeviceCommand(input, ctx),
	},
	cmdb_record_observation: {
		input: recordObservationInput,
		run: recordObservation,
	},
	cmdb_impact: { input: impactInput, run: cmdbImpact },
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
	assertEnvironmentAllowed({ name, requested, resolved, linked });
	const pending =
		name === "cluster_read_deployment"
			? (
					await db
						.select({ id: changes.id })
						.from(changes)
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
	if (
		pending &&
		!sameChangeEnvironment(changeEnvironment(pending.id), resolved.key)
	)
		throw new Error(
			`cannot verify change "${pending.id}" (environment "${changeEnvironment(pending.id)}") with a read against "${resolved.key}"`,
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
