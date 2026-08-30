import assert from "node:assert/strict";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { workflowExecutions, workflows } from "@/db/schema";
import { sweepExpiredWorkflowExecutions } from "./runtime";

test("workflow lease sweep expires only stranded running executions", async () => {
	const workflowId = crypto.randomUUID();
	const expiredId = crypto.randomUUID();
	const activeId = crypto.randomUUID();
	const terminalId = crypto.randomUUID();
	const now = new Date();
	await db.insert(workflows).values({
		id: workflowId,
		name: "lease test",
		triggerEvent: "test.lease",
	});
	await db.insert(workflowExecutions).values([
		{
			id: expiredId,
			workflowId,
			triggerEvent: "test.lease",
			recordType: "ticket",
			recordId: expiredId,
			status: "running",
			leaseExpiresAt: new Date(now.getTime() - 1),
		},
		{
			id: activeId,
			workflowId,
			triggerEvent: "test.lease",
			recordType: "ticket",
			recordId: activeId,
			status: "running",
			leaseExpiresAt: new Date(now.getTime() + 86_400_000),
		},
		{
			id: terminalId,
			workflowId,
			triggerEvent: "test.lease",
			recordType: "ticket",
			recordId: terminalId,
			status: "succeeded",
			leaseExpiresAt: new Date(now.getTime() - 1),
		},
	]);
	try {
		const swept = await sweepExpiredWorkflowExecutions(now);
		assert.equal(
			swept.some(({ id }) => id === expiredId),
			true,
		);
		const rows = await db
			.select({ id: workflowExecutions.id, status: workflowExecutions.status })
			.from(workflowExecutions)
			.where(inArray(workflowExecutions.id, [expiredId, activeId, terminalId]));
		assert.equal(rows.find(({ id }) => id === expiredId)?.status, "failed");
		assert.equal(rows.find(({ id }) => id === activeId)?.status, "running");
		assert.equal(rows.find(({ id }) => id === terminalId)?.status, "succeeded");
	} finally {
		await db
			.delete(workflowExecutions)
			.where(inArray(workflowExecutions.id, [expiredId, activeId, terminalId]));
		await db.delete(workflows).where(eq(workflows.id, workflowId));
	}
});
