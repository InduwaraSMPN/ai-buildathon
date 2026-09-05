import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps, environments } from "@/db/schema";
import { suppressedCallsForRun } from "@/server/connectors/terminal";
import { Gateway } from "@/server/grpc";
import { withFixtures } from "@/server/testing/fixtures";

/**
 * What the transcript keeps when the environment guard refuses a write.
 *
 * The refusal reaches the record by two different routes on purpose: the
 * gateway writes the guard's own text onto the step, so an operator sees why
 * nothing happened, while the worker is still handed the redacted call id, so
 * the model never learns the environment is in shadow and its proposal stays a
 * faithful sample of what it would have done in production. The same step row
 * is what the ITSM connector reads back as a suppressed call.
 */

const WORKER = "worker-shadow-test";

type GatewayInternals = {
	runAgents: Map<string, string>;
	handleToolRequest(
		stream: { write(value: unknown): void },
		request: Record<string, unknown>,
		workerId: string,
	): Promise<void>;
};

test("a shadow refusal is recorded verbatim on the step that attempted it", async () => {
	await withFixtures(async (fixtures) => {
		const ticketId = await fixtures.ticket();
		const runId = await fixtures.run({ ticketId });
		const environmentId = fixtures.id("environment");
		const key = `shadow-${environmentId.slice(-8)}`;
		const stepId = fixtures.id("step");
		const toolInput = {
			namespace: "demo",
			name: "checkout",
			container_index: 0,
			image: "repo/checkout:v2",
		};
		try {
			await db.insert(environments).values({
				id: environmentId,
				key,
				label: "Shadow under test",
				connectionType: "default",
				mode: "shadow",
			});
			await db
				.update(agentRuns)
				.set({
					environmentId,
					environmentKey: key,
					workerId: WORKER,
					leaseExpiresAt: new Date(Date.now() + 45_000),
				})
				.where(eq(agentRuns.id, runId));
			await db.insert(agentSteps).values({
				id: stepId,
				runId,
				ordinal: 1,
				kind: "tool_call",
				toolName: "cluster_patch_image",
				toolInput,
			});

			const writes: unknown[] = [];
			const gateway = new Gateway() as unknown as GatewayInternals;
			gateway.runAgents.set(runId, WORKER);
			await gateway.handleToolRequest(
				{ write: (value) => void writes.push(value) },
				{
					runId,
					callId: `call-${stepId}`,
					toolName: "cluster_patch_image",
					inputJson: JSON.stringify(toolInput),
					sourceStepOrdinal: 1,
				},
				WORKER,
			);

			const [step] = await db
				.select({ error: agentSteps.error })
				.from(agentSteps)
				.where(eq(agentSteps.id, stepId));
			assert.equal(
				step?.error,
				`environment "${key}" is in shadow mode; refusing write tool "cluster_patch_image"`,
			);
			// The connector turns exactly this row into a reviewable proposal, so a
			// refusal that no longer lands on the step silently empties the shadow
			// evaluation set rather than failing anything.
			assert.deepEqual(await suppressedCallsForRun(runId), [
				{ tool: "cluster_patch_image", input: toolInput, ordinal: 1 },
			]);
			// The worker still gets the redacted form: the intent is recorded
			// without telling the agent which mode it is running in.
			assert.deepEqual(writes, [
				{
					toolResult: {
						runId,
						callId: `call-${stepId}`,
						ok: false,
						error: `tool execution failed (call call-${stepId})`,
					},
				},
			]);
		} finally {
			await db.delete(environments).where(eq(environments.id, environmentId));
		}
	});
});
