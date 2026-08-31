import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import {
	changes,
	changeTicketLinks,
	changeTransitions,
} from "@/db/schema/changes";
import { patchImage, type patchImageInput, readDeployment } from "./cluster";
import type { ToolContext } from "./index";

// The environment a change was applied to. executeTool reads this when a
// verification read arrives so it can refuse to complete the change from a
// different cluster. Keyed by change id; kept for the life of the process so a
// patch and its verification share the value across the two tool calls.
const changeEnvironments = new Map<string, string>();

export function recordChangeEnvironment(changeId: string, key: string) {
	changeEnvironments.set(changeId, key);
}

export function changeEnvironment(changeId: string): string | undefined {
	return changeEnvironments.get(changeId);
}

export function resetChangeEnvironments() {
	changeEnvironments.clear();
}

const imageName = (image: string) => {
	const withoutDigest = image.split("@", 1)[0] ?? image;
	const slash = withoutDigest.lastIndexOf("/");
	const colon = withoutDigest.lastIndexOf(":");
	return colon > slash ? withoutDigest.slice(0, colon) : withoutDigest;
};

export function assertStandardImageChange(
	previous: string | undefined,
	next: string,
) {
	if (!previous)
		throw new Error("Container index does not exist or has no current image");
	if (previous === next) throw new Error("Requested image is already deployed");
	if (imageName(previous) !== imageName(next))
		throw new Error(
			"Standard changes may update only the tag or digest of the existing image",
		);
}

export async function patchImageWithChange(
	input: z.infer<typeof patchImageInput>,
	ctx: ToolContext,
) {
	const before = await readDeployment(
		input,
		ctx.environment ? { environment: ctx.environment } : undefined,
	);
	const previousImage = before.containers[input.container_index]?.image;
	assertStandardImageChange(previousImage, input.image);
	const now = new Date();
	const changeId = crypto.randomUUID();
	recordChangeEnvironment(changeId, ctx.environment?.key ?? "default");
	await db.transaction(async (tx) => {
		await tx.insert(changes).values({
			id: changeId,
			changeNumber: `CHG-AUTO-${changeId.slice(0, 8).toUpperCase()}`,
			title: `Update ${input.namespace}/${input.name} image`,
			description: `Axel requested ${previousImage} -> ${input.image}`,
			reasonForChange: `Resolve ticket ${ctx.ticketId}`,
			changeType: "standard",
			status: "in_progress",
			implementationPlan: `Replace container ${input.container_index} image with ${input.image}`,
			testPlan:
				"Wait for rollout, then verify the deployment with cluster_read_deployment",
			rollbackPlan: `Restore container ${input.container_index} image to ${previousImage}`,
			cabRequired: false,
			approvalAt: now,
			workStartAt: now,
			pirActualStartAt: now,
			verificationDeadlineAt: new Date(now.getTime() + 5 * 60_000),
			sourceRunId: ctx.runId,
			sourceStepId: ctx.stepId,
		});
		await tx.insert(changeTransitions).values({
			id: crypto.randomUUID(),
			changeId,
			fromStatus: "draft",
			toStatus: "in_progress",
			actorType: "agent",
			actorId: ctx.runId,
			runId: ctx.runId,
			stepId: ctx.stepId,
		});
		await tx.insert(changeTicketLinks).values({
			id: crypto.randomUUID(),
			changeId,
			ticketId: ctx.ticketId,
			linkType: "implements",
		});
	});
	try {
		const result = await patchImage(input, {
			environment: ctx.environment,
		});
		return { ...result, changeId, previousImage };
	} catch (error) {
		const failedAt = new Date();
		await db.transaction(async (tx) => {
			await tx
				.update(changes)
				.set({
					status: "failed",
					workEndAt: failedAt,
					pirWasSuccessful: false,
					pirActualEndAt: failedAt,
					pirFollowUp: error instanceof Error ? error.message : String(error),
				})
				.where(eq(changes.id, changeId));
			await tx.insert(changeTransitions).values({
				id: crypto.randomUUID(),
				changeId,
				fromStatus: "in_progress",
				toStatus: "failed",
				actorType: "agent",
				actorId: ctx.runId,
				runId: ctx.runId,
				stepId: ctx.stepId,
			});
		});
		throw error;
	}
}
