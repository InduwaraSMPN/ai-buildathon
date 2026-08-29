import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { changes, tickets } from "@/db/schema";
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

const pendingVerification = new Map<
	string,
	{ tool: string; changeId?: string }
>();

export const tools: Record<string, ToolHandler> = {
	knowledge_search: { input: knowledgeSearchInput, run: knowledgeSearch },
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
	const pending = pendingVerification.get(ctx.runId);
	const verifies = pending?.tool === name;
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
		pendingVerification.delete(ctx.runId);
		if (pending?.changeId) {
			const completedAt = new Date();
			await db
				.update(changes)
				.set({
					status: "completed",
					workEndAt: completedAt,
					pirWasSuccessful: true,
					pirActualEndAt: completedAt,
					pirReview: JSON.stringify(output),
					pirLessonsLearned: "Explicit post-change verification succeeded.",
				})
				.where(eq(changes.id, pending.changeId));
		}
	}
	if (handler.verifiedBy) {
		const changeId =
			output && typeof output === "object" && "changeId" in output
				? String(output.changeId)
				: undefined;
		pendingVerification.set(ctx.runId, { tool: handler.verifiedBy, changeId });
	}
	return output;
}
