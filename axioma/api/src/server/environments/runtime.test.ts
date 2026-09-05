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
		id: `test-rt-user-${ticketId}`,
		name: "runtime test",
		email: `test-rt-${ticketId}@example.test`,
	});
	await db.insert(tickets).values({
		id: ticketId,
		reporterId: `test-rt-user-${ticketId}`,
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

/**
 * `environments_default_uidx` allows one default row for the whole database, so
 * a test that asserts on the default has to own it. Seeded demo data holds one,
 * which is why these cannot simply insert their own or assume none exists.
 */
async function withoutExistingDefault<T>(body: () => Promise<T>): Promise<T> {
	const [existing] = await db
		.select({ id: environments.id })
		.from(environments)
		.where(eq(environments.isDefault, true))
		.limit(1);
	if (existing)
		await db
			.update(environments)
			.set({ isDefault: false })
			.where(eq(environments.id, existing.id));
	try {
		return await body();
	} finally {
		if (existing)
			await db
				.update(environments)
				.set({ isDefault: true })
				.where(eq(environments.id, existing.id));
	}
}

/**
 * Every test below seeds from inside its own `try`. Seeding above the `try` is
 * what leaked "Runtime ticket" rows into the demo database: an insert that
 * throws part-way through leaves the rows before it stranded, because the
 * `finally` that would have removed them was never entered.
 */
async function cleanup(ticketIds: string[], envIds: string[]) {
	for (const id of envIds) {
		await db.delete(environments).where(eq(environments.id, id));
	}
	for (const id of ticketIds) {
		await db.delete(tickets).where(eq(tickets.id, id));
		await db.delete(user).where(eq(user.id, `test-rt-user-${id}`));
	}
}

test("resolveRunEnvironment bootstraps a default when no environment rows exist", async () => {
	const ticketId = `test-rt-bootstrap-${suffix}`;
	try {
		await insertTicket(ticketId);
		await withoutExistingDefault(async () => {
			const resolved = await resolveRunEnvironment({
				id: ticketId,
				serviceId: "svc-general",
			});
			assert.deepEqual(resolved, {
				environmentId: null,
				environmentKey: "default",
				environmentSource: "default",
			});
		});
	} finally {
		await cleanup([ticketId], []);
	}
});

test("resolveRunEnvironment prefers a ticket-linked environment", async () => {
	const ticketId = `test-rt-ticket-${suffix}`;
	const envId = `test-rt-env-ticket-${suffix}`;
	const envKey = `test-rt-key-ticket-${suffix}`;
	try {
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
	const ticketId = `test-rt-default-${suffix}`;
	const envId = `test-rt-env-default-${suffix}`;
	const envKey = `test-rt-key-default-${suffix}`;
	try {
		await insertTicket(ticketId);
		await withoutExistingDefault(async () => {
			// This test's own environment must stop being the default before the
			// wrapper restores the one it displaced, so it is removed in here.
			try {
				await insertEnvironment(envId, envKey, true);
				await db.insert(serviceEnvironments).values({
					serviceId: "svc-general",
					environmentId: envId,
				});
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
				await db.delete(environments).where(eq(environments.id, envId));
			}
		});
	} finally {
		await cleanup([ticketId], []);
	}
});

test("loadRunEnvironment builds a connection and links for a persisted run", async () => {
	const ticketId = `test-rt-load-${suffix}`;
	const runId = `test-rt-run-${suffix}`;
	const envId = `test-rt-env-load-${suffix}`;
	const envKey = `test-rt-key-load-${suffix}`;
	try {
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
	const ticketId = `test-rt-grpc-${suffix}`;
	const runId = `test-rt-grpc-run-${suffix}`;
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
		await insertTicket(ticketId);
		await db.insert(agentRuns).values({
			id: runId,
			ticketId,
			status: "running",
		});
		await gateway.startRun({
			runId,
			ticketId,
			title: "Runtime grpc",
			body: "Body",
			reporterId: `test-rt-user-${ticketId}`,
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
	return `test-rt-key-${prefix}-${suffix}`;
}
