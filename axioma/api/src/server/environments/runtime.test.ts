import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
	agentRuns,
	environments,
	serviceEnvironments,
	ticketEnvironments,
	tickets,
	user,
} from "@/db/schema";
import { Gateway } from "../grpc";
import { loadRunEnvironment, resolveRunEnvironment } from "./runtime";

const suffix = crypto.randomUUID();

async function insertTicket(ticketId: string, serviceId = "svc-general") {
	await db.insert(user).values({
		id: `rt-user-${ticketId}`,
		name: "runtime test",
		email: `rt-${ticketId}@example.test`,
	});
	await db.insert(tickets).values({
		id: ticketId,
		reporterId: `rt-user-${ticketId}`,
		title: "Runtime ticket",
		body: "Body",
		serviceId,
		serviceSubcategoryId: "ss-general",
		status: "routing",
	});
}

async function insertEnvironment(id: string, key: string, isDefault = false) {
	await db.insert(environments).values({
		id,
		key,
		label: key,
		connectionType: "kubeconfig",
		isDefault,
	});
}

async function cleanup(ticketIds: string[], envIds: string[]) {
	for (const id of envIds) {
		await db.delete(environments).where(eq(environments.id, id));
	}
	for (const id of ticketIds) {
		await db.delete(tickets).where(eq(tickets.id, id));
		await db.delete(user).where(eq(user.id, `rt-user-${id}`));
	}
}

test("resolveRunEnvironment bootstraps a default when no environment rows exist", async () => {
	const ticketId = `rt-bootstrap-${suffix}`;
	await insertTicket(ticketId);
	try {
		const resolved = await resolveRunEnvironment({
			id: ticketId,
			serviceId: "svc-general",
		});
		assert.deepEqual(resolved, {
			environmentId: null,
			environmentKey: "default",
			environmentSource: "default",
		});
	} finally {
		await cleanup([ticketId], []);
	}
});

test("resolveRunEnvironment prefers a ticket-linked environment", async () => {
	const ticketId = `rt-ticket-${suffix}`;
	const envId = `rt-env-ticket-${suffix}`;
	const envKey = `rt-key-ticket-${suffix}`;
	await insertTicket(ticketId);
	await insertEnvironment(envId, envKey);
	await db.insert(serviceEnvironments).values({
		serviceId: "svc-general",
		environmentId: envId,
	});
	await db.insert(ticketEnvironments).values({
		ticketId,
		environmentId: envId,
	});
	try {
		const resolved = await resolveRunEnvironment({
			id: ticketId,
			serviceId: "svc-general",
		});
		assert.deepEqual(resolved, {
			environmentId: envId,
			environmentKey: envKey,
			environmentSource: "ticket",
		});
	} finally {
		await db
			.delete(ticketEnvironments)
			.where(eq(ticketEnvironments.ticketId, ticketId));
		await db
			.delete(serviceEnvironments)
			.where(eq(serviceEnvironments.environmentId, envId));
		await cleanup([ticketId], [envId]);
	}
});

test("resolveRunEnvironment falls back to the default environment", async () => {
	const ticketId = `rt-default-${suffix}`;
	const envId = `rt-env-default-${suffix}`;
	const envKey = `rt-key-default-${suffix}`;
	await insertTicket(ticketId);
	await insertEnvironment(envId, envKey, true);
	await db.insert(serviceEnvironments).values({
		serviceId: "svc-general",
		environmentId: envId,
	});
	try {
		const resolved = await resolveRunEnvironment({
			id: ticketId,
			serviceId: "svc-general",
		});
		assert.deepEqual(resolved, {
			environmentId: envId,
			environmentKey: envKey,
			environmentSource: "default",
		});
	} finally {
		await db
			.delete(serviceEnvironments)
			.where(eq(serviceEnvironments.environmentId, envId));
		await cleanup([ticketId], [envId]);
	}
});

test("loadRunEnvironment builds a connection and links for a persisted run", async () => {
	const ticketId = `rt-load-${suffix}`;
	const runId = `rt-run-${suffix}`;
	const envId = `rt-env-load-${suffix}`;
	const envKey = `rt-key-load-${suffix}`;
	await insertTicket(ticketId);
	await insertEnvironment(envId, envKey);
	await db.insert(serviceEnvironments).values({
		serviceId: "svc-general",
		environmentId: envId,
	});
	await db.insert(agentRuns).values({
		id: runId,
		ticketId,
		environmentId: envId,
		environmentKey: envKey,
		environmentSource: "ticket",
	});
	try {
		const result = await loadRunEnvironment(runId);
		assert.equal(result.environment?.key, envKey);
		assert.equal(result.environment?.mode, "act");
		assert.equal(result.environment?.connection.id, envId);
		assert.equal(result.environment?.connection.connectionType, "kubeconfig");
		assert.ok(result.linkedEnvironments.has(envKey));
	} finally {
		await db
			.delete(serviceEnvironments)
			.where(eq(serviceEnvironments.environmentId, envId));
		await db.delete(agentRuns).where(eq(agentRuns.id, runId));
		await cleanup([ticketId], [envId]);
	}
});

test("Gateway.startRun sends the resolved environment key", async () => {
	const ticketId = `rt-grpc-${suffix}`;
	const runId = `rt-grpc-run-${suffix}`;
	await insertTicket(ticketId);
	await db.insert(agentRuns).values({
		id: runId,
		ticketId,
		status: "running",
	});
	const writes: unknown[] = [];
	const gateway = new Gateway();
	const internals = gateway as unknown as {
		agents: Map<
			string,
			{
				stream: { write(value: unknown): void };
				model: string;
				generation: symbol;
			}
		>;
		agentOrder: string[];
		nextAgent: number;
	};
	internals.agents.set("worker-1", {
		stream: { write: (value) => void writes.push(value) },
		model: "test-model",
		generation: Symbol("test"),
	});
	internals.agentOrder = ["worker-1"];
	internals.nextAgent = 0;
	try {
		await gateway.startRun({
			runId,
			ticketId,
			title: "Runtime grpc",
			body: "Body",
			reporterId: `rt-user-${ticketId}`,
			environmentKey: envKey("grpc"),
		});
		const startRun = (writes[0] as { startRun: Record<string, unknown> })
			.startRun;
		assert.equal(startRun.environment, envKey("grpc"));
		assert.equal(startRun.recordType, "incident");
	} finally {
		await db.delete(agentRuns).where(eq(agentRuns.id, runId));
		await cleanup([ticketId], []);
	}
});

function envKey(prefix: string) {
	return `rt-key-${prefix}-${suffix}`;
}
