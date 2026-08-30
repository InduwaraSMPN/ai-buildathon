import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { and, eq, inArray, lt, max, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	agentRuns,
	agentSteps,
	agentToolCalls,
	deviceCommands,
	devices,
	searchReconciliationState,
	ticketStatusTransitions,
	tickets,
	ticketTransitions,
} from "@/db/schema";
import { RESOLUTION_CODES } from "@/shared";
import {
	createInboundQueue,
	leaseDeadline,
	replayToolResult,
	runMaintenanceJobs,
} from "./grpc-core";
import { ingestInventoryReport } from "./inventory";
import { sweepPending } from "./pending";
import { reconcileCoreSearchDocuments } from "./search/projections";
import { transitionTicketStopwatches } from "./sla/runtime";
import { sweepPresence, sweepSla } from "./sla/sweep";
import { findTicketTransition, resolveTicketStatus } from "./tickets";
import { executeTool, sweepExpiredChangeVerifications } from "./tools";
import { readContextForTicket } from "./tools/cmdb";
import { sweepExpiredWorkflowExecutions } from "./workflows/runtime";
import { sweepWebhookDeliveries } from "./workflows/webhooks";

type Message = Record<string, unknown>;
type Duplex = grpc.ServerDuplexStream<Message, Message>;
type DeviceCommand = {
	commandId: string;
	sequence: string;
	action: string;
	parameters: Record<string, string>;
	computerUse: boolean;
	objective: string;
	timeoutSeconds: number;
};
type DeviceConnection = {
	stream: Duplex;
	lastSeen: number;
	generation: symbol;
};
type AgentConnection = { stream: Duplex; model: string; generation: symbol };
type PendingCommand = {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer: NodeJS.Timeout;
};

const OUTBOX_LIMIT = 100;
const HEARTBEAT_MS = 10_000;
const STALE_MS = 30_000;
const RUN_LEASE_MS = 45_000;
const ENROLMENT_TTL_MS = 10 * 60_000;
const SEARCH_WATERMARK_KEY = "core";
const sourceProtoPath = fileURLToPath(
	new URL("../../proto/axioma.proto", import.meta.url),
);
const protoPath = existsSync(sourceProtoPath)
	? sourceProtoPath
	: resolve(process.cwd(), "proto/axioma.proto");
const definition = protoLoader.loadSync(protoPath, {
	defaults: true,
	longs: String,
	oneofs: true,
});
const axioma = (
	grpc.loadPackageDefinition(definition) as unknown as {
		axioma: { v1: Record<string, { service: grpc.ServiceDefinition }> };
	}
).axioma.v1;

export class Gateway {
	readonly server = new grpc.Server();
	private agents = new Map<string, AgentConnection>();
	private agentOrder: string[] = [];
	private nextAgent = 0;
	private runAgents = new Map<string, string>();
	private devices = new Map<string, DeviceConnection>();
	private sequences = new Map<string, number>();
	private sequenceQueues = new Map<string, Promise<void>>();
	private outboxes = new Map<string, DeviceCommand[]>();
	private pending = new Map<string, PendingCommand>();
	private heartbeat?: NodeJS.Timeout;
	private sweepRunning = false;
	private closed = false;

	constructor() {
		const agentChannel = axioma.AgentChannel;
		const deviceChannel = axioma.DeviceChannel;
		if (!agentChannel || !deviceChannel)
			throw new Error("invalid Axioma protobuf services");
		this.server.addService(agentChannel.service, {
			connect: (stream: Duplex) => this.connectAgent(stream),
		});
		this.server.addService(deviceChannel.service, {
			connect: (stream: Duplex) => this.connectDevice(stream),
		});
	}

	async listen(address = process.env.AXIOMA_GRPC_ADDRESS ?? "0.0.0.0:50051") {
		await this.reconcileOrphans();
		await new Promise<void>((resolve, reject) => {
			this.server.bindAsync(
				address,
				grpc.ServerCredentials.createInsecure(),
				(error) => {
					if (error) reject(error);
					else resolve();
				},
			);
		});
		this.closed = false;
		this.scheduleSweep();
		console.log(`[grpc] gateway listening on ${address}`);
	}

	async close() {
		this.closed = true;
		if (this.heartbeat) clearTimeout(this.heartbeat);
		for (const item of this.pending.values()) {
			clearTimeout(item.timer);
			item.reject(new Error("gateway shutting down"));
		}
		this.pending.clear();
		await new Promise<void>((resolve) =>
			this.server.tryShutdown(() => resolve()),
		);
	}

	hasWorker() {
		return this.agents.size > 0;
	}

	async startRun(input: {
		runId: string;
		ticketId: string;
		title: string;
		body: string;
		reporterId: string;
		deviceId?: string;
		contextJson?: string;
		recordType?: string;
		impact?: string;
		urgency?: string;
		priority?: string;
		origin?: string;
	}) {
		const selected = this.selectAgent();
		if (!selected) throw new Error("Axel is not connected");
		const contextJson =
			input.contextJson ??
			JSON.stringify(
				await readContextForTicket(input.ticketId, input.deviceId),
			);
		const run = await db
			.update(agentRuns)
			.set({
				model: selected.connection.model || null,
				workerId: selected.workerId,
				leaseExpiresAt: leaseDeadline(new Date(), RUN_LEASE_MS),
			})
			.where(
				and(eq(agentRuns.id, input.runId), eq(agentRuns.status, "running")),
			)
			.returning({ id: agentRuns.id });
		if (!run[0])
			throw new Error(`run not found or not running: ${input.runId}`);
		this.runAgents.set(input.runId, selected.workerId);
		try {
			selected.connection.stream.write({
				startRun: {
					runId: input.runId,
					ticketId: input.ticketId,
					title: input.title,
					body: input.body,
					reporterId: input.reporterId,
					deviceId: input.deviceId ?? "",
					contextJson,
					recordType: input.recordType ?? "incident",
					impact: input.impact ?? "medium",
					urgency: input.urgency ?? "medium",
					priority: input.priority ?? "P3",
					origin: input.origin ?? "portal",
				},
			});
		} catch (error) {
			this.runAgents.delete(input.runId);
			await db
				.update(agentRuns)
				.set({
					status: "failed",
					outcome: "agent dispatch failed",
					endedAt: new Date(),
				})
				.where(
					and(eq(agentRuns.id, input.runId), eq(agentRuns.status, "running")),
				);
			throw error;
		}
		console.log(
			`[grpc] run ${input.runId} sent to worker ${selected.workerId}`,
		);
	}

	async cancelRun(
		runId: string,
		reason = "run cancelled",
		leaseExpiredBefore?: Date,
	) {
		const workerId = this.runAgents.get(runId);
		const agent = workerId ? this.agents.get(workerId) : undefined;
		let cancelled = false;
		await db.transaction(async (tx) => {
			const activeTicket = (
				await tx
					.select({ status: tickets.status })
					.from(tickets)
					.innerJoin(agentRuns, eq(agentRuns.ticketId, tickets.id))
					.where(eq(agentRuns.id, runId))
					.limit(1)
			)[0];
			const run = (
				await tx
					.update(agentRuns)
					.set({
						status: "failed",
						outcome: reason,
						leaseExpiresAt: null,
						endedAt: new Date(),
					})
					.where(
						and(
							eq(agentRuns.id, runId),
							eq(agentRuns.status, "running"),
							leaseExpiredBefore
								? lt(agentRuns.leaseExpiresAt, leaseExpiredBefore)
								: undefined,
						),
					)
					.returning({ ticketId: agentRuns.ticketId })
			)[0];
			if (!run) return;
			cancelled = true;
			if (!activeTicket) throw new Error(`ticket not found for run: ${runId}`);
			const nextStatus = await resolveTicketStatus(
				activeTicket.status,
				"fail",
				tx,
			);
			const ticket = (
				await tx
					.update(tickets)
					.set({ status: nextStatus, progressMarker: "handing_to_person" })
					.where(
						and(
							eq(tickets.id, run.ticketId),
							eq(tickets.status, activeTicket.status),
						),
					)
					.returning({ id: tickets.id })
			)[0];
			if (ticket) {
				await tx.insert(ticketTransitions).values({
					id: crypto.randomUUID(),
					ticketId: run.ticketId,
					fromStatus: activeTicket.status,
					toStatus: nextStatus,
					action: "fail",
					actorType: "agent",
					actorId: runId,
				});
				await transitionTicketStopwatches(
					run.ticketId,
					nextStatus,
					new Date(),
					tx,
				);
			}
		});
		if (cancelled) {
			if (agent) agent.stream.write({ cancelRun: { runId, reason } });
			this.runAgents.delete(runId);
		}
	}

	async dispatchDeviceTool(
		runId: string,
		toolName: string,
		input: unknown,
		stepId?: string,
	) {
		if (!input || typeof input !== "object")
			throw new Error("device tool input must be an object");
		const body = input as Record<string, unknown>;
		const deviceId = String(body.device_id ?? "");
		if (!deviceId) throw new Error("device_id is required");

		let action: string;
		let parameters: Record<string, string>;
		let computerUse = false;
		let objective = "";
		let timeoutSeconds = 30;
		switch (toolName) {
			case "device_read_state":
				action = "read_state";
				parameters = { facets: JSON.stringify(body.facets ?? []) };
				if (body.target != null) parameters.target = String(body.target);
				break;
			case "device_run_action":
				action = String(body.action ?? "");
				parameters = Object.fromEntries(
					Object.entries(
						(body.parameters as Record<string, unknown>) ?? {},
					).map(([key, value]) => [key, String(value)]),
				);
				break;
			case "device_computer_use":
				action = "computer_use";
				parameters = {};
				computerUse = true;
				objective = String(body.objective ?? "");
				timeoutSeconds = Number(body.timeout_seconds ?? 120);
				break;
			default:
				throw new Error(`tool not implemented: ${toolName}`);
		}

		const command = await this.withDeviceSequence(deviceId, async () => {
			const previous =
				this.sequences.get(deviceId) ?? (await this.loadSequence(deviceId));
			const sequence = previous + 1;
			this.sequences.set(deviceId, sequence);
			const value: DeviceCommand = {
				commandId: crypto.randomUUID(),
				sequence: String(sequence),
				action,
				parameters,
				computerUse,
				objective,
				timeoutSeconds,
			};
			try {
				await db.insert(deviceCommands).values({
					id: value.commandId,
					deviceId,
					runId: runId || null,
					stepId: stepId || null,
					sequence,
					tool: toolName,
					input,
					status: "pending",
				});
			} catch (error) {
				this.sequences.delete(deviceId);
				throw error;
			}
			const outbox = this.outboxes.get(deviceId) ?? [];
			outbox.push(value);
			if (outbox.length > OUTBOX_LIMIT) outbox.shift();
			this.outboxes.set(deviceId, outbox);
			return value;
		});

		const result = new Promise<unknown>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(command.commandId);
				this.removeFromOutbox(deviceId, command.commandId);
				db.update(deviceCommands)
					.set({
						status: "timed_out",
						error: "device command timed out",
						completedAt: new Date(),
					})
					.where(
						and(
							eq(deviceCommands.id, command.commandId),
							inArray(deviceCommands.status, ["pending", "dispatched"]),
						),
					)
					.catch((error) =>
						console.error("[grpc] timeout persistence failed", error),
					);
				reject(new Error("device command timed out"));
			}, timeoutSeconds * 1000);
			this.pending.set(command.commandId, { resolve, reject, timer });
		});

		const connected = this.devices.get(deviceId);
		if (connected) {
			try {
				connected.stream.write({ command });
				await db
					.update(deviceCommands)
					.set({ status: "dispatched", dispatchedAt: new Date() })
					.where(
						and(
							eq(deviceCommands.id, command.commandId),
							eq(deviceCommands.status, "pending"),
						),
					);
			} catch (error) {
				const pending = this.pending.get(command.commandId);
				if (pending) clearTimeout(pending.timer);
				this.pending.delete(command.commandId);
				this.removeFromOutbox(deviceId, command.commandId);
				await db
					.update(deviceCommands)
					.set({
						status: "failed",
						error: "device dispatch failed",
						completedAt: new Date(),
					})
					.where(eq(deviceCommands.id, command.commandId));
				throw error;
			}
		}

		return result;
	}

	private connectAgent(stream: Duplex) {
		let workerId = "";
		let generation: symbol | undefined;
		const cleanup = () => this.removeAgent(workerId, generation);
		stream.on(
			"data",
			createInboundQueue(stream, async (message) => {
				const registered = await this.onAgentMessage(stream, message, workerId);
				if (registered) ({ workerId, generation } = registered);
			}),
		);
		stream.on("error", (error) => {
			cleanup();
			console.error("[grpc] agent stream error", error.message);
		});
		stream.on("end", () => {
			cleanup();
			stream.end();
		});
		stream.on("close", cleanup);
	}

	private async onAgentMessage(
		stream: Duplex,
		message: Message,
		workerId: string,
	) {
		if (message.hello) {
			const hello = message.hello as Record<string, unknown>;
			const workerId = String(hello.workerId ?? "").trim();
			if (!workerId) throw new Error("agent worker_id is required");
			const generation = Symbol(workerId);
			const old = this.agents.get(workerId);
			if (old && old.stream !== stream) old.stream.end();
			this.agents.set(workerId, {
				stream,
				model: String(hello.modelLabel ?? ""),
				generation,
			});
			if (!this.agentOrder.includes(workerId)) this.agentOrder.push(workerId);
			console.log(
				`[grpc] Axel worker=${workerId} model=${hello.modelLabel} connected`,
			);
			return { workerId, generation };
		}
		if (!workerId) throw new Error("agent must send hello before messages");
		if (message.runAccepted) {
			await this.renewRunLease(
				String((message.runAccepted as Record<string, unknown>).runId),
				workerId,
				true,
			);
			return;
		}
		if (message.heartbeat) {
			stream.write({ heartbeat: { unixMs: String(Date.now()) } });
			return;
		}
		if (message.toolRequest) {
			await this.handleToolRequest(
				stream,
				message.toolRequest as Record<string, unknown>,
				workerId,
			);
			return;
		}
		if (message.runUpdate)
			await this.persistRunUpdate(
				stream,
				message.runUpdate as Record<string, unknown>,
				workerId,
			);
	}

	private async handleToolRequest(
		stream: Duplex,
		request: Record<string, unknown>,
		workerId: string,
	) {
		const runId = String(request.runId);
		const callId = String(request.callId).trim();
		try {
			if (!callId) throw new Error("tool request call_id is required");
			if (this.runAgents.get(runId) !== workerId)
				throw new Error(`run ${runId} is not assigned to worker ${workerId}`);
			await this.renewRunLease(runId, workerId);
			const run = (
				await db
					.select({ ticketId: agentRuns.ticketId, status: agentRuns.status })
					.from(agentRuns)
					.where(eq(agentRuns.id, runId))
					.limit(1)
			)[0];
			if (!run) throw new Error(`run not found: ${runId}`);
			if (run.status !== "running") throw new Error(`run is ${run.status}`);
			const toolName = String(request.toolName);
			const input = JSON.parse(String(request.inputJson));
			if (toolName.startsWith("device_")) {
				const ticket = (
					await db
						.select({ deviceId: tickets.deviceId })
						.from(tickets)
						.where(eq(tickets.id, run.ticketId))
						.limit(1)
				)[0];
				if (!ticket?.deviceId || input?.device_id !== ticket.deviceId)
					throw new Error("device tool must target the ticket device");
			}
			const stepId = await this.resolveStepId(runId, request, toolName);
			const claimed = await db
				.insert(agentToolCalls)
				.values({
					id: crypto.randomUUID(),
					runId,
					callId,
				})
				.onConflictDoNothing({
					target: [agentToolCalls.runId, agentToolCalls.callId],
				})
				.returning({ id: agentToolCalls.id });
			if (!claimed[0]) {
				const existing = (
					await db
						.select({
							status: agentToolCalls.status,
							result: agentToolCalls.result,
							error: agentToolCalls.error,
						})
						.from(agentToolCalls)
						.where(
							and(
								eq(agentToolCalls.runId, runId),
								eq(agentToolCalls.callId, callId),
							),
						)
						.limit(1)
				)[0];
				if (!existing) throw new Error("tool call ledger conflict without row");
				stream.write(replayToolResult(runId, callId, existing));
				return;
			}
			await db.transaction(async (tx) => {
				const currentTicket = (
					await tx
						.select({ status: tickets.status })
						.from(tickets)
						.where(eq(tickets.id, run.ticketId))
						.limit(1)
				)[0];
				if (!currentTicket)
					throw new Error(`ticket not found: ${run.ticketId}`);
				const resolvingStatus = await findTicketTransition(
					currentTicket.status,
					"firstTool",
					tx,
				);
				if (!resolvingStatus) return;
				const beganResolving = await tx
					.update(tickets)
					.set({ status: resolvingStatus })
					.where(
						and(
							eq(tickets.id, run.ticketId),
							eq(tickets.status, currentTicket.status),
						),
					)
					.returning({ id: tickets.id });
				if (!beganResolving[0]) return;
				await tx.insert(ticketTransitions).values({
					id: crypto.randomUUID(),
					ticketId: run.ticketId,
					fromStatus: currentTicket.status,
					toStatus: resolvingStatus,
					action: "firstTool",
					actorType: "agent",
					actorId: runId,
				});
				await transitionTicketStopwatches(
					run.ticketId,
					resolvingStatus,
					new Date(),
					tx,
				);
			});
			const output = await executeTool(toolName, input, {
				runId,
				ticketId: run.ticketId,
				stepId,
				dispatchDevice: (toolName, input) =>
					this.dispatchDeviceTool(runId, toolName, input, stepId),
			});
			const structuredFailure =
				typeof output === "object" &&
				output !== null &&
				"ok" in output &&
				output.ok === false;
			const error = structuredFailure ? JSON.stringify(output) : null;
			await db
				.update(agentToolCalls)
				.set({
					status: structuredFailure ? "failed" : "succeeded",
					result: structuredFailure ? null : output,
					error,
					finishedAt: new Date(),
				})
				.where(
					and(
						eq(agentToolCalls.runId, runId),
						eq(agentToolCalls.callId, callId),
						eq(agentToolCalls.status, "in_progress"),
					),
				);
			stream.write({
				toolResult: {
					runId,
					callId,
					ok: !structuredFailure,
					...(structuredFailure
						? { error: error ?? "tool call failed" }
						: { outputJson: JSON.stringify(output) }),
				},
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (runId && callId)
				await db
					.update(agentToolCalls)
					.set({ status: "failed", error: message, finishedAt: new Date() })
					.where(
						and(
							eq(agentToolCalls.runId, runId),
							eq(agentToolCalls.callId, callId),
							eq(agentToolCalls.status, "in_progress"),
						),
					);
			stream.write({
				toolResult: {
					runId,
					callId,
					ok: false,
					error: message,
				},
			});
		}
	}

	private connectDevice(stream: Duplex) {
		let deviceId = "";
		let generation: symbol | undefined;
		stream.on(
			"data",
			createInboundQueue(stream, async (message) => {
				if (message.hello) {
					const hello = message.hello as Record<string, unknown>;
					deviceId = String(hello.deviceId);
					generation = Symbol(deviceId);
					await this.registerDevice(deviceId, generation, stream, hello);
				} else if (message.heartbeat && deviceId) {
					const connection = this.devices.get(deviceId);
					if (connection) connection.lastSeen = Date.now();
					await db
						.update(devices)
						.set({ lastSeenAt: new Date() })
						.where(eq(devices.id, deviceId));
				} else if (message.result && deviceId) {
					await this.completeCommand(
						deviceId,
						message.result as Record<string, unknown>,
					);
				} else if (message.inventory && deviceId) {
					await ingestInventoryReport(
						deviceId,
						message.inventory as Record<string, unknown>,
					);
				}
			}),
		);
		stream.on("error", (error) =>
			console.error("[grpc] device stream error", error.message),
		);
		stream.on("end", () => {
			stream.end();
			this.disconnectDevice(deviceId, generation).catch((error) =>
				console.error("[grpc] device disconnect failed", error),
			);
		});
		stream.on("close", () => {
			this.disconnectDevice(deviceId, generation).catch((error) =>
				console.error("[grpc] device disconnect failed", error),
			);
		});
	}

	private async registerDevice(
		deviceId: string,
		generation: symbol,
		stream: Duplex,
		hello: Record<string, unknown>,
	) {
		const old = this.devices.get(deviceId);
		if (old) old.stream.end();
		this.devices.set(deviceId, { stream, lastSeen: Date.now(), generation });
		const enrolmentCode = String(hello.enrolmentCode ?? "").trim() || null;
		const details = {
			hostname: String(hello.hostname),
			username: String(hello.username),
			platform: String(hello.platform),
			release: String(hello.release),
			agentVersion: String(hello.agentVersion),
			connected: "online" as const,
			lastSeenAt: new Date(),
		};
		const enrolment = enrolmentCode
			? {
					enrolmentCode,
					enrolmentCodeExpiresAt: new Date(Date.now() + ENROLMENT_TTL_MS),
				}
			: {};
		await db
			.insert(devices)
			.values({ id: deviceId, ...details, ...enrolment })
			.onConflictDoUpdate({ target: devices.id, set: details });
		if (enrolmentCode)
			await db
				.update(devices)
				.set(enrolment)
				.where(
					and(
						eq(devices.id, deviceId),
						sql`${devices.ownerId} is null`,
						sql`${devices.enrolmentCode} is null or ${devices.enrolmentCode} <> ${enrolmentCode}`,
					),
				);
		const enrollmentState = (
			await db
				.select({
					ownerId: devices.ownerId,
					code: devices.enrolmentCode,
					expiresAt: devices.enrolmentCodeExpiresAt,
				})
				.from(devices)
				.where(eq(devices.id, deviceId))
				.limit(1)
		)[0];
		stream.write({
			enrollment: {
				claimed: Boolean(enrollmentState?.ownerId),
				codeExpired: Boolean(
					enrollmentState?.code === enrolmentCode &&
						enrollmentState.expiresAt &&
						enrollmentState.expiresAt <= new Date(),
				),
			},
		});
		if (!this.sequences.has(deviceId))
			this.sequences.set(deviceId, await this.loadSequence(deviceId));
		const lastSeen = Number(hello.lastSeenSequence ?? 0);
		const replay = (this.outboxes.get(deviceId) ?? []).filter(
			(command) => Number(command.sequence) > lastSeen,
		);
		for (const command of replay) {
			stream.write({ command });
			await db
				.update(deviceCommands)
				.set({ status: "dispatched", dispatchedAt: new Date() })
				.where(
					and(
						eq(deviceCommands.id, command.commandId),
						eq(deviceCommands.status, "pending"),
					),
				);
		}
		console.log(
			`[grpc] device ${deviceId} connected; replayed=${replay.length} after=${lastSeen}`,
		);
	}

	private async disconnectDevice(deviceId: string, generation?: symbol) {
		if (!deviceId || this.devices.get(deviceId)?.generation !== generation)
			return;
		this.devices.delete(deviceId);
		this.sequences.delete(deviceId);
		this.outboxes.delete(deviceId);
		await db
			.update(devices)
			.set({ connected: "offline", lastSeenAt: new Date() })
			.where(eq(devices.id, deviceId));
	}

	private async completeCommand(
		deviceId: string,
		result: Record<string, unknown>,
	) {
		const commandId = String(result.commandId);
		const ok = Boolean(result.ok);
		let output: unknown = null;
		if (result.outputJson) {
			try {
				output = JSON.parse(String(result.outputJson));
			} catch {
				output = String(result.outputJson);
			}
		}
		const changed = await db
			.update(deviceCommands)
			.set({
				status: ok ? "succeeded" : "failed",
				output,
				error: result.error ? String(result.error) : null,
				completedAt: new Date(),
			})
			.where(
				and(
					eq(deviceCommands.id, commandId),
					eq(deviceCommands.deviceId, deviceId),
					inArray(deviceCommands.status, ["pending", "dispatched"]),
				),
			)
			.returning({ id: deviceCommands.id });
		if (!changed[0]) return;
		this.removeFromOutbox(deviceId, commandId);
		const pending = this.pending.get(commandId);
		if (pending) {
			clearTimeout(pending.timer);
			this.pending.delete(commandId);
			if (ok) pending.resolve(output);
			else
				pending.reject(
					new Error(String(result.error || "device command failed")),
				);
		}
	}

	private async loadSequence(deviceId: string) {
		const row = (
			await db
				.select({ value: max(deviceCommands.sequence) })
				.from(deviceCommands)
				.where(eq(deviceCommands.deviceId, deviceId))
		)[0];
		return row?.value ?? 0;
	}

	private async persistRunUpdate(
		stream: Duplex,
		update: Record<string, unknown>,
		workerId: string,
	) {
		const runId = String(update.runId);
		const ordinal = Number(update.ordinal);
		if (this.runAgents.get(runId) !== workerId) {
			if (update.status) {
				const committed = (
					await db
						.select({ status: agentRuns.status, workerId: agentRuns.workerId })
						.from(agentRuns)
						.where(eq(agentRuns.id, runId))
						.limit(1)
				)[0];
				if (
					committed?.workerId === workerId &&
					committed.status !== "running"
				) {
					stream.write({ terminalAck: { runId, ordinal } });
					return;
				}
			}
			throw new Error(`run ${runId} is not assigned to worker ${workerId}`);
		}
		await this.renewRunLease(runId, workerId);
		const parse = (value: unknown) => {
			if (!value) return null;
			try {
				return JSON.parse(String(value));
			} catch {
				return String(value);
			}
		};
		const kinds = [
			"observation",
			"think",
			"tool_call",
			"observation",
			"decision",
			"terminal",
		] as const;
		const rawKind = Number(update.kind);
		if (!Number.isInteger(rawKind) || rawKind < 1 || rawKind > 5)
			throw new Error(`invalid run update kind: ${rawKind}`);
		const toolOutput = parse(update.toolOutputJson);
		await db
			.insert(agentSteps)
			.values({
				id: crypto.randomUUID(),
				runId,
				ordinal,
				kind: kinds[rawKind] ?? "observation",
				reasoning: update.reasoning ? String(update.reasoning) : null,
				toolName: update.toolName ? String(update.toolName) : null,
				toolInput: parse(update.toolInputJson),
				toolOutput,
				error: update.error ? String(update.error) : null,
				evidence: update.evidence ? String(update.evidence) : null,
			})
			.onConflictDoNothing({ target: [agentSteps.runId, agentSteps.ordinal] });
		if (update.status) {
			const status = String(update.status);
			if (!["resolved", "escalated", "failed", "exhausted"].includes(status))
				throw new Error(`invalid terminal run status: ${status}`);
			const resolutionCode = String(update.resolutionCode || "");
			if (
				status === "resolved" &&
				!RESOLUTION_CODES.includes(
					resolutionCode as (typeof RESOLUTION_CODES)[number],
				)
			)
				throw new Error(`invalid resolution code: ${resolutionCode}`);
			await db.transaction(async (tx) => {
				const run = (
					await tx
						.select({ ticketId: agentRuns.ticketId })
						.from(agentRuns)
						.where(eq(agentRuns.id, runId))
						.limit(1)
				)[0];
				if (!run) throw new Error(`run not found: ${runId}`);
				const finished = await tx
					.update(agentRuns)
					.set({
						status: status as "resolved" | "escalated" | "failed" | "exhausted",
						outcome: String(update.outcome || "") || null,
						promptTokens: Number(update.promptTokens) || 0,
						completionTokens: Number(update.completionTokens) || 0,
						...(update.model ? { model: String(update.model) } : {}),
						leaseExpiresAt: null,
						endedAt: new Date(),
					})
					.where(and(eq(agentRuns.id, runId), eq(agentRuns.status, "running")))
					.returning({ id: agentRuns.id });
				if (!finished[0]) return;
				const resolved = status === "resolved";
				const action =
					status === "failed"
						? "fail"
						: status === "exhausted"
							? "exhaust"
							: resolved
								? "resolve"
								: "escalate";
				const currentTicket = (
					await tx
						.select({ status: tickets.status })
						.from(tickets)
						.where(eq(tickets.id, run.ticketId))
						.limit(1)
				)[0];
				if (!currentTicket)
					throw new Error(`ticket not found: ${run.ticketId}`);
				const fromStatus = currentTicket.status;
				const toStatus = await resolveTicketStatus(fromStatus, action, tx);
				const changed = await tx
					.update(tickets)
					.set({
						status: toStatus,
						resolution: String(update.outcome || "") || null,
						resolutionCode: resolved
							? (resolutionCode as (typeof RESOLUTION_CODES)[number])
							: undefined,
						resolvedAt: resolved ? new Date() : undefined,
						progressMarker: resolved ? "verifying_fix" : "handing_to_person",
					})
					.where(
						and(eq(tickets.id, run.ticketId), eq(tickets.status, fromStatus)),
					)
					.returning({ id: tickets.id });
				if (!changed[0])
					throw new Error(
						`ticket changed during terminal update: ${run.ticketId}`,
					);
				await tx.insert(ticketTransitions).values({
					id: crypto.randomUUID(),
					ticketId: run.ticketId,
					fromStatus,
					toStatus,
					action,
					actorType: "agent",
					actorId: runId,
				});
				await transitionTicketStopwatches(
					run.ticketId,
					toStatus,
					new Date(),
					tx,
				);
			});
			this.runAgents.delete(runId);
			stream.write({ terminalAck: { runId, ordinal } });
		}
	}

	private async resolveStepId(
		runId: string,
		request: Record<string, unknown>,
		toolName: string,
	) {
		const ordinal = Number(request.sourceStepOrdinal);
		if (!Number.isInteger(ordinal) || ordinal < 1)
			throw new Error("tool request source_step_ordinal is required");
		const step = (
			await db
				.select({ id: agentSteps.id })
				.from(agentSteps)
				.where(
					and(
						eq(agentSteps.runId, runId),
						eq(agentSteps.ordinal, ordinal),
						eq(agentSteps.kind, "tool_call"),
						eq(agentSteps.toolName, toolName),
					),
				)
				.limit(1)
		)[0];
		if (!step) throw new Error(`source step not found: ${runId}:${ordinal}`);
		return step.id;
	}

	private async renewRunLease(
		runId: string,
		workerId: string,
		accepted = false,
	) {
		const now = new Date();
		const renewed = await db
			.update(agentRuns)
			.set({
				workerId,
				leaseExpiresAt: leaseDeadline(now, RUN_LEASE_MS),
				...(accepted ? { acceptedAt: now } : {}),
			})
			.where(
				and(
					eq(agentRuns.id, runId),
					eq(agentRuns.status, "running"),
					eq(agentRuns.workerId, workerId),
				),
			)
			.returning({ id: agentRuns.id });
		if (!renewed[0]) throw new Error(`run ${runId} lease cannot be renewed`);
	}

	private selectAgent() {
		this.agentOrder = this.agentOrder.filter((id) => this.agents.has(id));
		if (!this.agentOrder.length) return undefined;
		const index = this.nextAgent++ % this.agentOrder.length;
		const workerId = this.agentOrder[index] as string;
		return {
			workerId,
			connection: this.agents.get(workerId) as AgentConnection,
		};
	}

	private removeAgent(workerId: string, generation?: symbol) {
		if (!workerId || this.agents.get(workerId)?.generation !== generation)
			return;
		this.agents.delete(workerId);
		this.agentOrder = this.agentOrder.filter((id) => id !== workerId);
		// Keep run assignments so this stable worker ID may replay retained terminal updates.
		console.log(`[grpc] Axel worker=${workerId} disconnected`);
	}

	private withDeviceSequence<T>(deviceId: string, operation: () => Promise<T>) {
		const previous = this.sequenceQueues.get(deviceId) ?? Promise.resolve();
		const result = previous.then(operation);
		const tail = result.then(
			() => undefined,
			() => undefined,
		);
		this.sequenceQueues.set(deviceId, tail);
		tail.finally(() => {
			if (this.sequenceQueues.get(deviceId) === tail)
				this.sequenceQueues.delete(deviceId);
		});
		return result;
	}

	private removeFromOutbox(deviceId: string, commandId: string) {
		const outbox = this.outboxes.get(deviceId);
		if (!outbox) return;
		const remaining = outbox.filter(
			(command) => command.commandId !== commandId,
		);
		if (remaining.length) this.outboxes.set(deviceId, remaining);
		else this.outboxes.delete(deviceId);
	}

	private async reconcileOrphans() {
		const now = new Date();
		await db.transaction(async (tx) => {
			await tx
				.update(deviceCommands)
				.set({
					status: "timed_out",
					error: "gateway restarted before dispatch",
					completedAt: now,
				})
				.where(inArray(deviceCommands.status, ["pending", "dispatched"]));
			const orphanedRuns = await tx
				.update(agentRuns)
				.set({
					status: "failed",
					outcome: "gateway restarted during run",
					leaseExpiresAt: null,
					endedAt: now,
				})
				.where(eq(agentRuns.status, "running"))
				.returning({ ticketId: agentRuns.ticketId });
			if (!orphanedRuns.length) return;
			const ids = orphanedRuns.map(({ ticketId }) => ticketId);
			await tx
				.update(tickets)
				.set({
					status: sql`(
						select ${ticketStatusTransitions.toStatus}
						from ${ticketStatusTransitions}
						where ${ticketStatusTransitions.fromStatus} = ${tickets.status}
							and ${ticketStatusTransitions.action} = 'fail'
					)`,
					resolution: "gateway restarted during run",
					progressMarker: "handing_to_person",
				})
				.where(
					and(
						inArray(tickets.id, ids),
						sql`exists (
							select 1 from ${ticketStatusTransitions}
							where ${ticketStatusTransitions.fromStatus} = ${tickets.status}
								and ${ticketStatusTransitions.action} = 'fail'
						)`,
					),
				);
		});
	}

	private scheduleSweep() {
		if (this.closed) return;
		this.heartbeat = setTimeout(async () => {
			if (this.sweepRunning) return this.scheduleSweep();
			this.sweepRunning = true;
			try {
				await this.sweep();
			} catch (error) {
				console.error("[grpc] sweep failed", error);
			} finally {
				this.sweepRunning = false;
				this.scheduleSweep();
			}
		}, HEARTBEAT_MS);
		this.heartbeat.unref();
	}

	private async reconcileSearch(now: Date) {
		const watermark = (
			await db
				.select({
					lastReconciledAt: searchReconciliationState.lastReconciledAt,
				})
				.from(searchReconciliationState)
				.where(eq(searchReconciliationState.key, SEARCH_WATERMARK_KEY))
				.limit(1)
		)[0]?.lastReconciledAt;
		await reconcileCoreSearchDocuments(db, watermark ?? new Date(0));
		await db
			.insert(searchReconciliationState)
			.values({ key: SEARCH_WATERMARK_KEY, lastReconciledAt: now })
			.onConflictDoUpdate({
				target: searchReconciliationState.key,
				set: { lastReconciledAt: now },
			});
	}

	private async expireRunLeases(now: Date) {
		const expired = await db
			.select({ id: agentRuns.id })
			.from(agentRuns)
			.where(
				and(eq(agentRuns.status, "running"), lt(agentRuns.leaseExpiresAt, now)),
			);
		for (const { id } of expired)
			await this.cancelRun(id, "agent run lease expired", now);
	}

	private async sweep() {
		const now = Date.now();
		const jobs = [
			["sla", () => sweepSla(new Date(now))],
			["pending", () => sweepPending(new Date(now))],
			["presence", () => sweepPresence(new Date(now))],
			["webhooks", () => sweepWebhookDeliveries(db, 25, fetch, new Date(now))],
			["workflow leases", () => sweepExpiredWorkflowExecutions(new Date(now))],
			["search", () => this.reconcileSearch(new Date(now))],
			["run leases", () => this.expireRunLeases(new Date(now))],
			[
				"change verification",
				() => sweepExpiredChangeVerifications(new Date(now)),
			],
		] as const;
		await runMaintenanceJobs(jobs, (name, reason) =>
			console.error(`[grpc] ${name} sweep failed`, reason),
		);
		for (const { stream } of this.agents.values()) {
			try {
				stream.write({ heartbeat: { unixMs: String(now) } });
			} catch (error) {
				console.error("[grpc] agent heartbeat failed", error);
			}
		}
		for (const [deviceId, connection] of this.devices) {
			try {
				if (now - connection.lastSeen > STALE_MS) {
					connection.stream.end();
					await this.disconnectDevice(deviceId, connection.generation);
				} else {
					connection.stream.write({ heartbeat: { unixMs: String(now) } });
				}
			} catch (error) {
				console.error(`[grpc] device ${deviceId} sweep failed`, error);
			}
		}
	}
}

export const grpcGateway = new Gateway();
