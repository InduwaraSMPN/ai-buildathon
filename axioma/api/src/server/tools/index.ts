import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import {
	patchImage,
	patchImageInput,
	readDeployment,
	readDeploymentInput,
	readPods,
	readPodsInput,
} from "./cluster";
import { recordObservation, recordObservationInput } from "./cmdb";
import {
	deviceActionInput,
	deviceComputerUseInput,
	deviceReadInput,
} from "./device";

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

const pendingVerification = new Map<string, string>();

export const tools: Record<string, ToolHandler> = {
	"cluster.read_pods": { input: readPodsInput, run: readPods },
	"cluster.read_deployment": {
		input: readDeploymentInput,
		run: readDeployment,
	},
	"cluster.patch_image": {
		input: patchImageInput,
		verifiedBy: "cluster.read_deployment",
		run: patchImage,
	},
	"device.read_state": device(deviceReadInput),
	"device.run_action": device(deviceActionInput, "device.read_state"),
	"device.computer_use": device(deviceComputerUseInput, "device.read_state"),
	"cmdb.record_observation": {
		input: recordObservationInput,
		run: recordObservation,
	},
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
	const verifies = pendingVerification.get(ctx.runId) === name;
	const marker = verifies
		? "verifying_fix"
		: name === "cluster.patch_image" ||
				name.startsWith("device.run_") ||
				name === "device.computer_use"
			? "applying_fix"
			: name.startsWith("cluster.read_")
				? "checking_service"
				: name === "device.read_state"
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
	if (verifies) pendingVerification.delete(ctx.runId);
	if (handler.verifiedBy)
		pendingVerification.set(ctx.runId, handler.verifiedBy);
	return output;
}
