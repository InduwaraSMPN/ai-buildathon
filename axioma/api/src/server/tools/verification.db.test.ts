import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps, changes } from "@/db/schema";
import { withFixtures } from "@/server/testing/fixtures";
import {
	executeTool,
	type ResolvedEnvironment,
	type ToolContext,
	tools,
} from "./index";

/**
 * The transcript's claim that a particular read confirmed a particular write.
 *
 * Only a real database can answer this: the obligation lives in the change
 * ledger, and the whole point of the column is that the API — not the model —
 * decides when a read has discharged one. These run against the development
 * database, so every row is seeded through `withFixtures` and removed again
 * from a `finally`; the change is deleted here because `changes.source_run_id`
 * is set null rather than cascaded when its run goes.
 */

const environment: ResolvedEnvironment = {
	key: "prod",
	mode: "act",
	connection: { id: "prod", key: "prod", connectionType: "default" },
};

/**
 * Stands in for the cluster call. What is under test is what the API records
 * about a read, not what the cluster returns, and a suite that needed a live
 * deployment could not assert the negative case at all.
 */
async function withStubbedRead(body: () => Promise<void>) {
	const handler = tools.cluster_read_deployment;
	if (!handler) throw new Error("cluster_read_deployment is not registered");
	const real = handler.run;
	handler.run = async () => ({
		name: "checkout",
		containers: [{ name: "checkout", image: "repo/checkout:v2" }],
	});
	try {
		await body();
	} finally {
		handler.run = real;
	}
}

async function seed(fixtures: {
	ticket(): Promise<string>;
	run(values: { ticketId: string }): Promise<string>;
	id(kind: string): string;
}) {
	const ticketId = await fixtures.ticket();
	const runId = await fixtures.run({ ticketId });
	// The cross-environment guard compares the change's run environment with the
	// one the read resolves to, so the run has to carry one.
	await db
		.update(agentRuns)
		.set({ environmentKey: environment.key })
		.where(eq(agentRuns.id, runId));
	const stepId = fixtures.id("step");
	await db.insert(agentSteps).values({
		id: stepId,
		runId,
		ordinal: 1,
		kind: "tool_call",
		toolName: "cluster_read_deployment",
	});
	const ctx: ToolContext = {
		runId,
		ticketId,
		stepId,
		dispatchDevice: async () => ({}),
		environment,
		linkedEnvironments: new Set([environment.key]),
	};
	return { ctx, runId, stepId };
}

test("a read that discharges a verification names the write it confirmed", async () => {
	await withFixtures(async (fixtures) => {
		const { ctx, runId, stepId } = await seed(fixtures);
		const changeId = fixtures.id("change");
		try {
			await db.insert(changes).values({
				id: changeId,
				changeNumber: `CHG-${changeId.slice(-8).toUpperCase()}`,
				title: "Update demo/checkout image",
				status: "in_progress",
				sourceRunId: runId,
				verificationDeadlineAt: new Date(Date.now() + 5 * 60_000),
			});
			await withStubbedRead(() =>
				executeTool(
					"cluster_read_deployment",
					{ namespace: "demo", name: "checkout" },
					ctx,
				).then(() => undefined),
			);
			const [step] = await db
				.select({ verifiesTool: agentSteps.verifiesTool })
				.from(agentSteps)
				.where(eq(agentSteps.id, stepId));
			assert.equal(
				step?.verifiesTool,
				"cluster_patch_image",
				"the verifying read did not name the write it confirmed",
			);
			// The same read is what completes the change, so the two records must
			// agree; a step marked as verifying an open obligation would be a claim
			// the ledger does not support.
			const [change] = await db
				.select({ status: changes.status })
				.from(changes)
				.where(eq(changes.id, changeId));
			assert.equal(change?.status, "completed");
		} finally {
			await db.delete(changes).where(eq(changes.id, changeId));
		}
	});
});

test("a diagnostic read of the same deployment records no verification", async () => {
	await withFixtures(async (fixtures) => {
		const { ctx, stepId } = await seed(fixtures);
		// Same tool, same arguments, same run — only the outstanding obligation is
		// missing. This is the step the verifying one used to be indistinguishable
		// from.
		await withStubbedRead(() =>
			executeTool(
				"cluster_read_deployment",
				{ namespace: "demo", name: "checkout" },
				ctx,
			).then(() => undefined),
		);
		const [step] = await db
			.select({ verifiesTool: agentSteps.verifiesTool })
			.from(agentSteps)
			.where(eq(agentSteps.id, stepId));
		assert.equal(
			step?.verifiesTool,
			null,
			"a read with nothing to confirm was recorded as a verification",
		);
	});
});
