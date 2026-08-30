import { and, eq, isNotNull, lte } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { changes, changeTransitions, tickets } from "@/db/schema";
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
import { knowledgeSearch, knowledgeSearchInput } from "./knowledge";
import { ticketReadMessages, ticketReadMessagesInput } from "./messages";

export type ToolContext = {
	runId: string;
	ticketId: string;
	stepId: string;
	dispatchDevice: (tool: string, input: unknown) => Promise<unknown>;
};

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
