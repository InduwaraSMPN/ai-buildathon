import { fileURLToPath } from "node:url";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { and, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps, deviceCommands, devices } from "@/db/schema";

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
type PendingCommand = {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer: NodeJS.Timeout;
};

const OUTBOX_LIMIT = 100;
const HEARTBEAT_MS = 10_000;
const STALE_MS = 30_000;
const protoPath = fileURLToPath(
	new URL("../../proto/axioma.proto", import.meta.url),
);
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

class Gateway {
	readonly server = new grpc.Server();
	private agent?: Duplex;
	private devices = new Map<string, DeviceConnection>();
	private sequences = new Map<string, number>();
	private outboxes = new Map<string, DeviceCommand[]>();
	private pending = new Map<string, PendingCommand>();
	private heartbeat?: NodeJS.Timeout;

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
		this.heartbeat = setInterval(() => void this.sweep(), HEARTBEAT_MS);
		this.heartbeat.unref();
		console.log(`[grpc] gateway listening on ${address}`);
	}

	async close() {
		if (this.heartbeat) clearInterval(this.heartbeat);
		for (const item of this.pending.values()) {
			clearTimeout(item.timer);
			item.reject(new Error("gateway shutting down"));
		}
		this.pending.clear();
		await new Promise<void>((resolve) =>
			this.server.tryShutdown(() => resolve()),
		);
	}

	async startRun(input: {
		runId: string;
		ticketId: string;
		title: string;
		body: string;
		reporterId: string;
		deviceId?: string;
		contextJson?: string;
	}) {
		if (!this.agent) throw new Error("Axel is not connected");
		await db
			.insert(agentRuns)
			.values({ id: input.runId, ticketId: input.ticketId });
		this.agent.write({
			startRun: {
				runId: input.runId,
				ticketId: input.ticketId,
				title: input.title,
				body: input.body,
				reporterId: input.reporterId,
				deviceId: input.deviceId ?? "",
				contextJson: input.contextJson ?? "{}",
			},
		});
		console.log(`[grpc] run ${input.runId} sent to Axel`);
	}

	async dispatchDeviceTool(runId: string, toolName: string, input: unknown) {
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
			case "device.read_state":
				action = "read_state";
				parameters = { facets: JSON.stringify(body.facets ?? []) };
				break;
			case "device.run_action":
				action = String(body.action ?? "");
				parameters = Object.fromEntries(
					Object.entries(
						(body.parameters as Record<string, unknown>) ?? {},
					).map(([key, value]) => [key, String(value)]),
				);
				break;
			case "device.computer_use":
				action = "computer_use";
				parameters = {};
				computerUse = true;
				objective = String(body.objective ?? "");
				timeoutSeconds = Number(body.timeout_seconds ?? 120);
				break;
			default:
				throw new Error(`tool not implemented: ${toolName}`);
		}

		const sequence =
			(this.sequences.get(deviceId) ?? (await this.loadSequence(deviceId))) + 1;
		this.sequences.set(deviceId, sequence);
		const command: DeviceCommand = {
			commandId: crypto.randomUUID(),
			sequence: String(sequence),
			action,
			parameters,
			computerUse,
			objective,
			timeoutSeconds,
		};
		const outbox = this.outboxes.get(deviceId) ?? [];
		outbox.push(command);
		if (outbox.length > OUTBOX_LIMIT) outbox.shift();
		this.outboxes.set(deviceId, outbox);

		await db.insert(deviceCommands).values({
			id: command.commandId,
			deviceId,
			runId: runId || null,
			sequence,
			tool: toolName,
			input,
			status: this.devices.has(deviceId) ? "dispatched" : "pending",
			dispatchedAt: this.devices.has(deviceId) ? new Date() : null,
		});
		this.devices.get(deviceId)?.stream.write({ command });
		console.log(
			`[grpc] command ${command.commandId} seq=${sequence} dispatched to ${deviceId}`,
		);

		return new Promise<unknown>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(command.commandId);
				void db
					.update(deviceCommands)
					.set({
						status: "timed_out",
						error: "device command timed out",
						completedAt: new Date(),
					})
					.where(eq(deviceCommands.id, command.commandId));
				reject(new Error("device command timed out"));
			}, timeoutSeconds * 1000);
			this.pending.set(command.commandId, { resolve, reject, timer });
		});
	}

	private connectAgent(stream: Duplex) {
		stream.on(
			"data",
			(message: Message) => void this.onAgentMessage(stream, message),
		);
		stream.on("error", (error) =>
			console.error("[grpc] agent stream error", error.message),
		);
		stream.on("end", () => {
			if (this.agent === stream) this.agent = undefined;
			stream.end();
			console.log("[grpc] Axel disconnected");
		});
	}

	private async onAgentMessage(stream: Duplex, message: Message) {
		if (message.hello) {
			this.agent = stream;
			const hello = message.hello as Record<string, unknown>;
			console.log(
				`[grpc] Axel connected version=${hello.agentVersion} model=${hello.modelLabel}`,
			);
			return;
		}
		if (message.heartbeat) {
			stream.write({ heartbeat: { unixMs: String(Date.now()) } });
			return;
		}
		if (message.toolRequest) {
			const request = message.toolRequest as Record<string, unknown>;
			try {
				const output = String(request.toolName).startsWith("device.")
					? await this.dispatchDeviceTool(
							String(request.runId),
							String(request.toolName),
							JSON.parse(String(request.inputJson)),
						)
					: (() => {
							throw new Error(`tool not implemented: ${request.toolName}`);
						})();
				stream.write({
					toolResult: {
						runId: request.runId,
						callId: request.callId,
						ok: true,
						outputJson: JSON.stringify(output),
					},
				});
			} catch (error) {
				stream.write({
					toolResult: {
						runId: request.runId,
						callId: request.callId,
						ok: false,
						error: error instanceof Error ? error.message : String(error),
					},
				});
			}
			return;
		}
		if (message.runUpdate)
			await this.persistRunUpdate(message.runUpdate as Record<string, unknown>);
	}

	private connectDevice(stream: Duplex) {
		let deviceId = "";
		let generation: symbol | undefined;
		stream.on("data", (message: Message) => {
			void (async () => {
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
				}
			})().catch((error) => stream.emit("error", error));
		});
		stream.on("error", (error) =>
			console.error("[grpc] device stream error", error.message),
		);
		stream.on("end", () => {
			stream.end();
			void this.disconnectDevice(deviceId, generation);
		});
		stream.on("close", () => void this.disconnectDevice(deviceId, generation));
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
		await db
			.insert(devices)
			.values({
				id: deviceId,
				hostname: String(hello.hostname),
				username: String(hello.username),
				platform: String(hello.platform),
				release: String(hello.release),
				agentVersion: String(hello.agentVersion),
				connected: "online",
				lastSeenAt: new Date(),
			})
			.onConflictDoUpdate({
				target: devices.id,
				set: {
					hostname: String(hello.hostname),
					username: String(hello.username),
					platform: String(hello.platform),
					release: String(hello.release),
					agentVersion: String(hello.agentVersion),
					connected: "online",
					lastSeenAt: new Date(),
				},
			});
		if (!this.sequences.has(deviceId))
			this.sequences.set(deviceId, await this.loadSequence(deviceId));
		const lastSeen = Number(hello.lastSeenSequence ?? 0);
		const replay = (this.outboxes.get(deviceId) ?? []).filter(
			(command) => Number(command.sequence) > lastSeen,
		);
		for (const command of replay) stream.write({ command });
		if (replay.length) {
			await db
				.update(deviceCommands)
				.set({ status: "dispatched", dispatchedAt: new Date() })
				.where(
					and(
						eq(deviceCommands.deviceId, deviceId),
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
		await db
			.update(devices)
			.set({ connected: "offline", lastSeenAt: new Date() })
			.where(eq(devices.id, deviceId));
		console.log(`[grpc] device ${deviceId} disconnected`);
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
		await db
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
				),
			);
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
		console.log(`[grpc] command ${commandId} result ok=${ok} from ${deviceId}`);
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

	private async persistRunUpdate(update: Record<string, unknown>) {
		const runId = String(update.runId);
		const ordinal = Number(update.ordinal);
		const parse = (value: unknown) => {
			if (!value) return null;
			try {
				return JSON.parse(String(value));
			} catch {
				return String(value);
			}
		};
		const kind = [
			"unspecified",
			"think",
			"tool_call",
			"observation",
			"decision",
			"terminal",
		];
		await db.insert(agentSteps).values({
			id: `${runId}:${ordinal}`,
			runId,
			ordinal,
			kind: kind[Number(update.kind)] ?? "unspecified",
			reasoning: update.reasoning ? String(update.reasoning) : null,
			toolName: update.toolName ? String(update.toolName) : null,
			toolInput: parse(update.toolInputJson),
			toolOutput: parse(update.toolOutputJson),
			error: update.error ? String(update.error) : null,
		});
		if (update.status) {
			await db
				.update(agentRuns)
				.set({
					status: String(update.status),
					outcome: String(update.outcome),
					endedAt: new Date(),
				})
				.where(eq(agentRuns.id, runId));
		}
	}

	private async sweep() {
		const now = Date.now();
		this.agent?.write({ heartbeat: { unixMs: String(now) } });
		for (const [deviceId, connection] of this.devices) {
			if (now - connection.lastSeen > STALE_MS) {
				connection.stream.end();
				await this.disconnectDevice(deviceId, connection.generation);
			} else {
				connection.stream.write({ heartbeat: { unixMs: String(now) } });
			}
		}
	}
}

export const grpcGateway = new Gateway();
