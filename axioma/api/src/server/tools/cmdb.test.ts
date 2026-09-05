import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
	agentRuns,
	agentSteps,
	cmdbClasses,
	cmdbObjects,
	searchDocuments,
	tickets,
	user,
} from "@/db/schema";
import { recordObservation, validateAttributes } from "./cmdb";

const properties = [
	{
		id: "name",
		propertyKey: "hostname",
		propertyType: "string",
		isRequired: true,
	},
	{
		id: "cores",
		propertyKey: "cores",
		propertyType: "integer",
		isRequired: false,
	},
];

test("recorded observations populate every provenance column", async () => {
	const suffix = crypto.randomUUID();
	const userId = `cmdb-user-${suffix}`;
	const ticketId = `cmdb-ticket-${suffix}`;
	const runId = `cmdb-run-${suffix}`;
	const stepId = `cmdb-step-${suffix}`;
	const classId = `cmdb-class-${suffix}`;
	let objectId: string | undefined;
	await db.insert(user).values({
		id: userId,
		name: "CMDB Test",
		email: `${userId}@example.test`,
	});
	await db.insert(tickets).values({
		id: ticketId,
		reporterId: userId,
		title: "Observe host",
		body: "Observe host",
	});
	await db.insert(agentRuns).values({ id: runId, ticketId });
	await db.insert(agentSteps).values({
		id: stepId,
		runId,
		ordinal: 1,
		kind: "tool_call",
	});
	await db.insert(cmdbClasses).values({
		id: classId,
		key: classId,
		label: "Test class",
	});
	try {
		const result = await recordObservation(
			{ class_key: classId, external_id: `host-${suffix}`, name: "Test host" },
			{ ticketId, runId, stepId },
		);
		assert.equal(result.ok, true);
		assert(result.ok);
		objectId = result.id;
		const [observation] = await db
			.select({
				sourceTicketId: cmdbObjects.sourceTicketId,
				sourceRunId: cmdbObjects.sourceRunId,
				sourceStepId: cmdbObjects.sourceStepId,
				observedAt: cmdbObjects.observedAt,
			})
			.from(cmdbObjects)
			.where(eq(cmdbObjects.id, objectId));
		assert.deepEqual(
			{
				sourceTicketId: observation?.sourceTicketId,
				sourceRunId: observation?.sourceRunId,
				sourceStepId: observation?.sourceStepId,
			},
			{ sourceTicketId: ticketId, sourceRunId: runId, sourceStepId: stepId },
		);
		assert(observation?.observedAt instanceof Date);
	} finally {
		if (objectId) {
			await db
				.delete(searchDocuments)
				.where(eq(searchDocuments.objectId, objectId));
			await db.delete(cmdbObjects).where(eq(cmdbObjects.id, objectId));
		}
		await db.delete(cmdbClasses).where(eq(cmdbClasses.id, classId));
		await db.delete(agentSteps).where(eq(agentSteps.id, stepId));
		await db.delete(agentRuns).where(eq(agentRuns.id, runId));
		await db.delete(tickets).where(eq(tickets.id, ticketId));
		await db.delete(user).where(eq(user.id, userId));
	}
});

test("attribute validation returns structured unknown and typed errors", () => {
	assert.deepEqual(
		validateAttributes("Server", { surprise: true }, properties),
		[
			{
				code: "unknown_property",
				// The declared set is part of the message: a refusal the agent
				// cannot act on costs a whole run, and the class keys are not
				// guessable from the ticket.
				message:
					'Class "Server" does not declare property "surprise". Declared properties: hostname, cores',
				classKey: "Server",
				propertyKey: "surprise",
			},
			{
				code: "missing_property",
				message: 'Class "Server" requires property "hostname"',
				classKey: "Server",
				propertyKey: "hostname",
			},
		],
	);
	assert.deepEqual(
		validateAttributes("Server", { hostname: "db", cores: "8" }, properties),
		[
			{
				code: "invalid_property_type",
				message: 'Property "cores" on class "Server" must be integer',
				classKey: "Server",
				propertyKey: "cores",
				expectedType: "integer",
			},
		],
	);
});
