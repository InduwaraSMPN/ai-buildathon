import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
	agentRuns,
	authProviders,
	deviceEnrolmentTokens,
	devices,
	directoryIdentities,
	tickets,
	ticketTransitions,
	user,
} from "@/db/schema";
import { hashDeviceSecret, issueDeviceCredential } from "./device-auth";
import { Gateway, readReporterContext } from "./grpc";
import {
	createInboundQueue,
	createNonOverlappingTask,
	leaseDeadline,
	replayToolResult,
	runMaintenanceJobs,
} from "./grpc-core";

test("inbound queue pauses at its bound and resumes after draining", async () => {
	let release = () => {};
	const blocked = new Promise<void>((resolve) => {
		release = resolve;
	});
	let pauses = 0;
	let resumes = 0;
	const stream = {
		pause: () => {
			pauses++;
		},
		resume: () => {
			resumes++;
		},
		destroy: (error?: Error) => {
			throw error;
		},
	};
	const enqueue = createInboundQueue(stream, () => blocked, 2);
	enqueue({ first: true });
	enqueue({ second: true });
	assert.equal(pauses, 1);
	release();
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(resumes, 1);
});

test("inbound queue destroys the stream and drops messages after rejection", async () => {
	let destroyed: Error | undefined;
	let handled = 0;
	const stream = {
		pause: () => {},
		resume: () => {},
		destroy: (error?: Error) => {
			destroyed = error;
		},
	};
	const enqueue = createInboundQueue(stream, async () => {
		if (++handled === 1) throw new Error("bad message");
	});
	enqueue({ hello: true });
	enqueue({ result: true });
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(destroyed?.message, "bad message");
	assert.equal(handled, 1);
});

test("device stream drops a result queued behind refused authentication", async () => {
	const gateway = new Gateway();
	let completed = 0;
	const stream = Object.assign(new EventEmitter(), {
		pause: () => {},
		resume: () => {},
		write: () => true,
		end: () => {},
		destroy: () => {},
	}) as never;
	const internals = gateway as unknown as {
		connectDevice(stream: never): void;
		completeCommand(
			deviceId: string,
			result: Record<string, unknown>,
		): Promise<void>;
	};
	internals.completeCommand = async () => {
		completed++;
	};
	internals.connectDevice(stream);
	(stream as EventEmitter).emit("data", {
		hello: { deviceId: crypto.randomUUID(), credential: "invalid" },
	});
	(stream as EventEmitter).emit("data", { result: { commandId: "attacker" } });
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(completed, 0);
});

test("lease renewal is anchored to the current activity", () => {
	assert.equal(
		leaseDeadline(new Date("2026-08-30T12:00:00.000Z"), 45_000).toISOString(),
		"2026-08-30T12:00:45.000Z",
	);
});

test("maintenance runner coalesces overlapping calls", async () => {
	let release = () => {};
	let calls = 0;
	const run = createNonOverlappingTask(() => {
		calls++;
		return calls === 1
			? new Promise<void>((resolve) => {
					release = resolve;
				})
			: Promise.resolve();
	});
	const first = run();
	const second = run();
	assert.equal(first, second);
	assert.equal(calls, 1);
	release();
	await first;
	await run();
	assert.equal(calls, 2);
});

test("maintenance failures are isolated from later heartbeat work", async () => {
	const ran: string[] = [];
	const failures: string[] = [];
	await runMaintenanceJobs(
		[
			["broken", async () => Promise.reject(new Error("database unavailable"))],
			["heartbeat", async () => void ran.push("heartbeat")],
		],
		(name) => failures.push(name),
	);
	assert.deepEqual(ran, ["heartbeat"]);
	assert.deepEqual(failures, ["broken"]);
});

test("reporter context uses synced directory data and degrades without it", async () => {
	const suffix = crypto.randomUUID();
	const managerId = `grpc-manager-${suffix}`;
	const reporterId = `grpc-reporter-${suffix}`;
	const plainUserId = `grpc-plain-${suffix}`;
	const providerId = `grpc-provider-${suffix}`;
	await db.insert(user).values([
		{ id: managerId, name: "Morgan Lee", email: `${managerId}@example.test` },
		{
			id: reporterId,
			name: "Avery Chen",
			email: `${reporterId}@example.test`,
			jobTitle: "Finance Analyst",
			managerId,
		},
		{
			id: plainUserId,
			name: "No Sync",
			email: `${plainUserId}@example.test`,
			jobTitle: "Support Engineer",
			managerId,
		},
	]);
	await db.insert(authProviders).values({
		id: providerId,
		providerId,
		name: "Test directory",
		discoveryUrl: "https://example.test/.well-known/openid-configuration",
		clientId: "test",
		clientSecretEncrypted: "test",
	});
	await db.insert(directoryIdentities).values({
		id: `grpc-identity-${suffix}`,
		providerId,
		userId: reporterId,
		externalId: `external-${suffix}`,
		department: "Finance",
		lastSeenAt: new Date(),
	});
	try {
		assert.deepEqual(await readReporterContext(reporterId), {
			name: "Avery Chen",
			jobTitle: "Finance Analyst",
			department: "Finance",
			manager: "Morgan Lee",
		});
		assert.deepEqual(await readReporterContext(plainUserId), {
			name: "No Sync",
			jobTitle: "Support Engineer",
			department: "",
			manager: "Morgan Lee",
		});
	} finally {
		await db
			.delete(directoryIdentities)
			.where(eq(directoryIdentities.providerId, providerId));
		await db.delete(authProviders).where(eq(authProviders.id, providerId));
		await db.delete(user).where(eq(user.id, reporterId));
		await db.delete(user).where(eq(user.id, plainUserId));
		await db.delete(user).where(eq(user.id, managerId));
	}
});

test("known device impersonation is refused before connection registration or replay", async () => {
	const deviceId = crypto.randomUUID();
	const credential = issueDeviceCredential();
	await db.insert(devices).values({
		id: deviceId,
		hostname: "auth-test",
		credentialHash: hashDeviceSecret(credential),
		enrolledAt: new Date(),
	});
	const writes: unknown[] = [];
	const gateway = new Gateway();
	const stream = {
		write: (value: unknown) => void writes.push(value),
		end: () => {},
		destroy: () => {},
	} as never;
	const registerDevice = (
		gateway as unknown as {
			registerDevice(
				deviceId: string,
				generation: symbol,
				stream: never,
				hello: Record<string, unknown>,
			): Promise<void>;
		}
	).registerDevice.bind(gateway);
	try {
		await assert.rejects(
			registerDevice(deviceId, Symbol(deviceId), stream, {
				deviceId,
				hostname: "attacker",
				credential: "wrong",
			}),
			(error: unknown) =>
				error instanceof Error &&
				error.message === "device authentication failed",
		);
		assert.deepEqual(writes, []);
		assert.equal(
			(gateway as unknown as { devices: Map<string, unknown> }).devices.has(
				deviceId,
			),
			false,
		);
	} finally {
		await db.delete(devices).where(eq(devices.id, deviceId));
	}
});

test("enrolment token is single-use and issues a credential", async () => {
	const firstDeviceId = crypto.randomUUID();
	const secondDeviceId = crypto.randomUUID();
	const token = `axen_${crypto.randomUUID()}`;
	await db.insert(deviceEnrolmentTokens).values({
		id: crypto.randomUUID(),
		tokenHash: hashDeviceSecret(token),
		expiresAt: new Date(Date.now() + 60_000),
	});
	const writes: Array<Record<string, unknown>> = [];
	const gateway = new Gateway();
	const stream = {
		write: (value: Record<string, unknown>) => void writes.push(value),
		end: () => {},
		destroy: () => {},
	} as never;
	const registerDevice = (
		gateway as unknown as {
			registerDevice(
				deviceId: string,
				generation: symbol,
				stream: never,
				hello: Record<string, unknown>,
			): Promise<void>;
		}
	).registerDevice.bind(gateway);
	try {
		await registerDevice(firstDeviceId, Symbol(firstDeviceId), stream, {
			deviceId: firstDeviceId,
			hostname: "first",
			enrolmentToken: token,
		});
		assert.ok(
			String((writes[0]?.enrollment as Record<string, unknown>)?.credential),
		);
		await assert.rejects(() =>
			registerDevice(secondDeviceId, Symbol(secondDeviceId), stream, {
				deviceId: secondDeviceId,
				hostname: "second",
				enrolmentToken: token,
			}),
		);
	} finally {
		await db.delete(devices).where(eq(devices.id, firstDeviceId));
		await db
			.delete(deviceEnrolmentTokens)
			.where(eq(deviceEnrolmentTokens.tokenHash, hashDeviceSecret(token)));
	}
});

test("expired enrolment token is refused without creating a device", async () => {
	const deviceId = crypto.randomUUID();
	const token = `axen_${crypto.randomUUID()}`;
	await db.insert(deviceEnrolmentTokens).values({
		id: crypto.randomUUID(),
		tokenHash: hashDeviceSecret(token),
		expiresAt: new Date(Date.now() - 60_000),
	});
	const gateway = new Gateway();
	const registerDevice = (
		gateway as unknown as {
			registerDevice(
				deviceId: string,
				generation: symbol,
				stream: never,
				hello: Record<string, unknown>,
			): Promise<void>;
		}
	).registerDevice.bind(gateway);
	try {
		await assert.rejects(() =>
			registerDevice(deviceId, Symbol(deviceId), { write: () => {} } as never, {
				deviceId,
				enrolmentToken: token,
			}),
		);
		assert.deepEqual(
			await db
				.select({ id: devices.id })
				.from(devices)
				.where(eq(devices.id, deviceId)),
			[],
		);
	} finally {
		await db
			.delete(deviceEnrolmentTokens)
			.where(eq(deviceEnrolmentTokens.tokenHash, hashDeviceSecret(token)));
	}
});

test("credential rotation invalidates the old credential and permits reconnect", async () => {
	const deviceId = crypto.randomUUID();
	const oldCredential = issueDeviceCredential();
	await db.insert(devices).values({
		id: deviceId,
		hostname: "rotation-test",
		credentialHash: hashDeviceSecret(oldCredential),
		enrolledAt: new Date(),
	});
	const writes: Record<string, unknown>[] = [];
	const gateway = new Gateway();
	const stream = {
		write: (value: Record<string, unknown>) => writes.push(value),
		end: () => {},
		destroy: () => {},
	} as never;
	const registerDevice = (
		gateway as unknown as {
			registerDevice(
				deviceId: string,
				generation: symbol,
				stream: never,
				hello: Record<string, unknown>,
			): Promise<void>;
		}
	).registerDevice.bind(gateway);
	try {
		await registerDevice(deviceId, Symbol(deviceId), stream, {
			deviceId,
			credential: oldCredential,
		});
		assert.equal(await gateway.rotateDeviceCredential(deviceId), true);
		const rotated = String(
			(writes.at(-1)?.enrollment as Record<string, unknown>)?.credential,
		);
		assert.notEqual(rotated, oldCredential);
		await assert.rejects(() =>
			registerDevice(deviceId, Symbol(deviceId), stream, {
				deviceId,
				credential: oldCredential,
			}),
		);
		await registerDevice(deviceId, Symbol(deviceId), stream, {
			deviceId,
			credential: rotated,
		});
	} finally {
		await db.delete(devices).where(eq(devices.id, deviceId));
	}
});

test("revocation disconnects the device and blocks reconnect", async () => {
	const deviceId = crypto.randomUUID();
	const credential = issueDeviceCredential();
	await db.insert(devices).values({
		id: deviceId,
		hostname: "revocation-test",
		credentialHash: hashDeviceSecret(credential),
		enrolledAt: new Date(),
	});
	let destroyed: Error | undefined;
	const gateway = new Gateway();
	const stream = {
		write: () => {},
		end: () => {},
		destroy: (error?: Error) => {
			destroyed = error;
		},
	} as never;
	const registerDevice = (
		gateway as unknown as {
			registerDevice(
				deviceId: string,
				generation: symbol,
				stream: never,
				hello: Record<string, unknown>,
			): Promise<void>;
		}
	).registerDevice.bind(gateway);
	try {
		await registerDevice(deviceId, Symbol(deviceId), stream, {
			deviceId,
			credential,
		});
		assert.ok(await gateway.revokeDevice(deviceId));
		assert.equal(destroyed?.message, "device authentication failed");
		await assert.rejects(() =>
			registerDevice(deviceId, Symbol(deviceId), stream, {
				deviceId,
				credential,
			}),
		);
	} finally {
		await db.delete(devices).where(eq(devices.id, deviceId));
	}
});

test("terminal persistence commits run, ticket, transition, then acknowledges", async () => {
	const suffix = crypto.randomUUID();
	const userId = `grpc-user-${suffix}`;
	const ticketId = `grpc-ticket-${suffix}`;
	const runId = `grpc-run-${suffix}`;
	await db.insert(user).values({
		id: userId,
		name: "gRPC terminal test",
		email: `${userId}@example.test`,
	});
	await db.insert(tickets).values({
		id: ticketId,
		reporterId: userId,
		title: "Terminal transaction",
		body: "Verify terminal persistence",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
		status: "resolving",
	});
	await db.insert(agentRuns).values({
		id: runId,
		ticketId,
		workerId: "worker-1",
		leaseExpiresAt: new Date(Date.now() + 45_000),
	});
	const writes: unknown[] = [];
	const gateway = new Gateway();
	const internals = gateway as unknown as {
		runAgents: Map<string, string>;
		persistRunUpdate(
			stream: { write(value: unknown): void },
			update: Record<string, unknown>,
			workerId: string,
		): Promise<void>;
	};
	internals.runAgents.set(runId, "worker-1");
	try {
		await internals.persistRunUpdate(
			{ write: (value) => void writes.push(value) },
			{
				runId,
				ordinal: 1,
				kind: 5,
				status: "resolved",
				outcome: "fixed",
				resolutionCode: "fixed",
			},
			"worker-1",
		);
		const [run] = await db
			.select()
			.from(agentRuns)
			.where(eq(agentRuns.id, runId));
		const [ticket] = await db
			.select()
			.from(tickets)
			.where(eq(tickets.id, ticketId));
		const transitions = await db
			.select()
			.from(ticketTransitions)
			.where(eq(ticketTransitions.ticketId, ticketId));
		assert.equal(run?.status, "resolved");
		assert.equal(ticket?.status, "resolved");
		assert.equal(transitions.at(-1)?.action, "resolve");
		assert.deepEqual(writes, [{ terminalAck: { runId, ordinal: 1 } }]);
		assert.equal(internals.runAgents.has(runId), false);
	} finally {
		await db.delete(tickets).where(eq(tickets.id, ticketId));
		await db.delete(user).where(eq(user.id, userId));
	}
});

test("terminal transaction failure retains assignment and sends no ack", async () => {
	const suffix = crypto.randomUUID();
	const userId = `grpc-fail-user-${suffix}`;
	const ticketId = `grpc-fail-ticket-${suffix}`;
	const runId = `grpc-fail-run-${suffix}`;
	await db.insert(user).values({
		id: userId,
		name: "gRPC failure",
		email: `${userId}@example.test`,
	});
	await db.insert(tickets).values({
		id: ticketId,
		reporterId: userId,
		title: "Failure",
		body: "Failure",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
		status: "closed",
	});
	await db.insert(agentRuns).values({
		id: runId,
		ticketId,
		workerId: "worker-1",
		leaseExpiresAt: new Date(Date.now() + 45_000),
	});
	const writes: unknown[] = [];
	const gateway = new Gateway();
	const internals = gateway as unknown as {
		runAgents: Map<string, string>;
		persistRunUpdate(
			stream: { write(value: unknown): void },
			update: Record<string, unknown>,
			workerId: string,
		): Promise<void>;
	};
	internals.runAgents.set(runId, "worker-1");
	try {
		await assert.rejects(() =>
			internals.persistRunUpdate(
				{ write: (value) => void writes.push(value) },
				{
					runId,
					ordinal: 1,
					kind: 5,
					status: "resolved",
					outcome: "fixed",
					resolutionCode: "fixed",
				},
				"worker-1",
			),
		);
		const [run] = await db
			.select()
			.from(agentRuns)
			.where(eq(agentRuns.id, runId));
		assert.equal(run?.status, "running");
		assert.equal(internals.runAgents.get(runId), "worker-1");
		assert.deepEqual(writes, []);
	} finally {
		await db.delete(tickets).where(eq(tickets.id, ticketId));
		await db.delete(user).where(eq(user.id, userId));
	}
});

test("replayed committed terminal sends acknowledgement again", async () => {
	const suffix = crypto.randomUUID();
	const userId = `grpc-replay-user-${suffix}`;
	const ticketId = `grpc-replay-ticket-${suffix}`;
	const runId = `grpc-replay-run-${suffix}`;
	await db.insert(user).values({
		id: userId,
		name: "gRPC replay",
		email: `${userId}@example.test`,
	});
	await db.insert(tickets).values({
		id: ticketId,
		reporterId: userId,
		title: "Replay",
		body: "Replay",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	});
	await db.insert(agentRuns).values({
		id: runId,
		ticketId,
		workerId: "worker-1",
		status: "resolved",
		endedAt: new Date(),
	});
	const writes: unknown[] = [];
	const gateway = new Gateway();
	const internals = gateway as unknown as {
		persistRunUpdate(
			stream: { write(value: unknown): void },
			update: Record<string, unknown>,
			workerId: string,
		): Promise<void>;
	};
	try {
		await internals.persistRunUpdate(
			{ write: (value) => void writes.push(value) },
			{ runId, ordinal: 7, status: "resolved" },
			"worker-1",
		);
		assert.deepEqual(writes, [{ terminalAck: { runId, ordinal: 7 } }]);
	} finally {
		await db.delete(tickets).where(eq(tickets.id, ticketId));
		await db.delete(user).where(eq(user.id, userId));
	}
});

test("expired lease fails once while a renewed lease remains running", async () => {
	const suffix = crypto.randomUUID();
	const userId = `grpc-lease-user-${suffix}`;
	const expiredTicketId = `grpc-expired-ticket-${suffix}`;
	const activeTicketId = `grpc-active-ticket-${suffix}`;
	const expiredRunId = `grpc-expired-run-${suffix}`;
	const activeRunId = `grpc-active-run-${suffix}`;
	const now = new Date();
	await db.insert(user).values({
		id: userId,
		name: "gRPC lease",
		email: `${userId}@example.test`,
	});
	await db.insert(tickets).values([
		{
			id: expiredTicketId,
			reporterId: userId,
			title: "Expired",
			body: "Expired",
			serviceId: "svc-general",
			serviceSubcategoryId: "ss-general",
			status: "resolving",
		},
		{
			id: activeTicketId,
			reporterId: userId,
			title: "Active",
			body: "Active",
			serviceId: "svc-general",
			serviceSubcategoryId: "ss-general",
			status: "resolving",
		},
	]);
	await db.insert(agentRuns).values([
		{
			id: expiredRunId,
			ticketId: expiredTicketId,
			workerId: "worker-1",
			leaseExpiresAt: new Date(now.getTime() - 1),
		},
		{
			id: activeRunId,
			ticketId: activeTicketId,
			workerId: "worker-1",
			leaseExpiresAt: new Date(now.getTime() + 45_000),
		},
	]);
	const gateway = new Gateway();
	const internals = gateway as unknown as {
		runAgents: Map<string, string>;
		expireRunLeases(now: Date): Promise<void>;
	};
	internals.runAgents.set(expiredRunId, "worker-1");
	internals.runAgents.set(activeRunId, "worker-1");
	try {
		await internals.expireRunLeases(now);
		await internals.expireRunLeases(now);
		const rows = await db
			.select({ id: agentRuns.id, status: agentRuns.status })
			.from(agentRuns)
			.where(and(eq(agentRuns.workerId, "worker-1")));
		assert.equal(rows.find(({ id }) => id === expiredRunId)?.status, "failed");
		assert.equal(rows.find(({ id }) => id === activeRunId)?.status, "running");
		assert.equal(internals.runAgents.has(expiredRunId), false);
		assert.equal(internals.runAgents.get(activeRunId), "worker-1");
	} finally {
		await db.delete(tickets).where(and(eq(tickets.reporterId, userId)));
		await db.delete(user).where(eq(user.id, userId));
	}
});

test("replayed tool calls never request execution and preserve settled results", () => {
	assert.deepEqual(
		replayToolResult("run-1", "call-1", {
			status: "succeeded",
			result: { value: 42 },
			error: null,
		}),
		{
			toolResult: {
				runId: "run-1",
				callId: "call-1",
				ok: true,
				outputJson: '{"value":42}',
			},
		},
	);
	assert.deepEqual(
		replayToolResult("run-1", "call-2", {
			status: "in_progress",
			result: null,
			error: null,
		}),
		{
			toolResult: {
				runId: "run-1",
				callId: "call-2",
				ok: false,
				error: "tool call is already in progress",
			},
		},
	);
});
