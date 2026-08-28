import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname, platform, release, userInfo } from "node:os";
import { dirname, join } from "node:path";

import {
	DEVICE_PING_INTERVAL_MS,
	type DeviceCommandMessage,
	type DeviceHello,
	type DeviceMessage,
	type DeviceResultMessage,
} from "@axioma/shared";

import { runAction } from "./actions";
import { readState } from "./state";

/**
 * The device agent.
 *
 * Runs in the background on an employee laptop and holds an outbound connection
 * to the backend. Outbound because the laptop is behind NAT, roams between
 * networks, and sleeps — nothing can dial in to it.
 */

const AGENT_VERSION = "0.1.0";
const SERVER_URL =
	process.env.AXIOMA_SERVER_URL ?? "ws://localhost:3000/device";

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_CAP_MS = 30_000;
const PONG_DEADLINE_MS = 10_000;

/**
 * Device identity.
 *
 * A UUID generated once and persisted next to the agent. It survives restarts,
 * reinstalls of Node, and network roaming, and dies with the user profile —
 * which is the right lifetime for "this person's laptop".
 */
function loadDeviceId(): string {
	const base = process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share");
	const file = join(base, "axioma", "device.json");

	try {
		const parsed = JSON.parse(readFileSync(file, "utf8")) as {
			deviceId?: string;
		};
		if (parsed.deviceId) return parsed.deviceId;
	} catch {
		// First run, or the file is unreadable. Either way, mint a new one.
	}

	const deviceId = randomUUID();
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, JSON.stringify({ deviceId }, null, 2), "utf8");
	return deviceId;
}

function buildHello(deviceId: string, lastSeenSequence: number): DeviceHello {
	let username: string | null = null;
	try {
		username = userInfo().username;
	} catch {
		username = null;
	}

	return {
		type: "hello",
		deviceId,
		hostname: hostname(),
		username,
		platform: platform(),
		release: release(),
		agentVersion: AGENT_VERSION,
		lastSeenSequence,
	};
}

async function handleCommand(
	message: DeviceCommandMessage,
): Promise<DeviceResultMessage> {
	try {
		const output =
			message.tool === "device.read_state"
				? await readState(message.input)
				: await runAction(message.input);

		return {
			type: "result",
			commandId: message.commandId,
			sequence: message.sequence,
			ok: true,
			output,
		};
	} catch (error) {
		return {
			type: "result",
			commandId: message.commandId,
			sequence: message.sequence,
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function connect(
	deviceId: string,
	state: { lastSeenSequence: number; attempt: number },
): void {
	const socket = new WebSocket(
		`${SERVER_URL}?deviceId=${encodeURIComponent(deviceId)}`,
	);

	let pingTimer: NodeJS.Timeout | undefined;
	let pongDeadline: NodeJS.Timeout | undefined;
	let closed = false;

	const teardown = (): void => {
		if (closed) return;
		closed = true;
		clearInterval(pingTimer);
		clearTimeout(pongDeadline);

		// Exponential backoff with jitter. A fleet waking together must not stampede.
		const backoff = Math.min(
			RECONNECT_BASE_MS * 2 ** state.attempt,
			RECONNECT_CAP_MS,
		);
		const jittered = backoff * (0.5 + Math.random() * 0.5);
		state.attempt += 1;
		setTimeout(() => connect(deviceId, state), jittered);
	};

	socket.addEventListener("open", () => {
		state.attempt = 0;
		socket.send(JSON.stringify(buildHello(deviceId, state.lastSeenSequence)));

		// A sleeping laptop does not close its TCP connection, it just stops
		// answering. Only an application-level ping notices.
		pingTimer = setInterval(() => {
			socket.send(JSON.stringify({ type: "ping" }));
			pongDeadline = setTimeout(() => socket.close(), PONG_DEADLINE_MS);
		}, DEVICE_PING_INTERVAL_MS);
	});

	socket.addEventListener("message", (event) => {
		let message: DeviceMessage;
		try {
			message = JSON.parse(String(event.data)) as DeviceMessage;
		} catch {
			return;
		}

		if (message.type === "pong") {
			clearTimeout(pongDeadline);
			return;
		}

		if (message.type === "ping") {
			socket.send(JSON.stringify({ type: "pong" }));
			return;
		}

		if (message.type === "command") {
			void handleCommand(message).then((result) => {
				state.lastSeenSequence = Math.max(
					state.lastSeenSequence,
					message.sequence,
				);
				socket.send(JSON.stringify(result));
			});
		}
	});

	socket.addEventListener("close", teardown);
	socket.addEventListener("error", teardown);
}

const deviceId = loadDeviceId();
console.log(`axioma agent ${AGENT_VERSION} — device ${deviceId}`);
connect(deviceId, { lastSeenSequence: 0, attempt: 0 });
