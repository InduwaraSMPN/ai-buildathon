/**
 * Domain vocabulary shared across services.
 *
 * Procedure inputs and outputs live in `@axioma/api`. What lives here is the
 * vocabulary those procedures are written in — states, routes, outcomes — so the
 * agent, the connectors, the CLI, and both frontends agree on the words without
 * importing the API surface.
 */

export const TICKET_STATUSES = [
	"open",
	"routing",
	"resolving",
	"resolved",
	"escalated",
	"closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Where a ticket was routed. `unassigned` until routing runs. */
export const TICKET_ROUTES = [
	"unassigned",
	"infrastructure",
	"device",
	"application",
	"identity",
	"human_triage",
] as const;
export type TicketRoute = (typeof TICKET_ROUTES)[number];

export const RUN_STATUSES = [
	"running",
	"resolved",
	"escalated",
	"failed",
	/** Hit the tool-call or model-turn ceiling. Escalates rather than continuing. */
	"exhausted",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const STEP_KINDS = [
	"think",
	"tool_call",
	"observation",
	"decision",
] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const DEVICE_CONNECTION_STATES = ["online", "offline"] as const;
export type DeviceConnectionState = (typeof DEVICE_CONNECTION_STATES)[number];

export const COMMAND_STATUSES = [
	"pending",
	"dispatched",
	"succeeded",
	"failed",
	"timed_out",
] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

/**
 * Ceilings on a single agent run.
 *
 * Without these a confused agent loops and the ticket neither resolves nor
 * escalates. Hitting either ends the run as `exhausted`.
 */
export const RUN_LIMITS = {
	maxToolCalls: 20,
	maxModelTurns: 10,
	runDeadlineMs: 5 * 60_000,
} as const;

/** Wire protocol between the CLI and the device gateway. */
export type DeviceHello = {
	type: "hello";
	deviceId: string;
	hostname: string;
	username: string | null;
	platform: string;
	release: string;
	agentVersion: string;
	/** Last sequence the device processed, so the server can replay past it. */
	lastSeenSequence: number;
};

export type DeviceCommandMessage = {
	type: "command";
	commandId: string;
	sequence: number;
	tool: string;
	input: unknown;
};

export type DeviceResultMessage = {
	type: "result";
	commandId: string;
	sequence: number;
	ok: boolean;
	output?: unknown;
	error?: string;
};

export type DevicePing = { type: "ping" };
export type DevicePong = { type: "pong" };

export type DeviceMessage =
	| DeviceHello
	| DeviceCommandMessage
	| DeviceResultMessage
	| DevicePing
	| DevicePong;

/** Client ping interval. The server sweeps at a longer interval than this. */
export const DEVICE_PING_INTERVAL_MS = 25_000;
export const DEVICE_SWEEP_INTERVAL_MS = 30_000;

/** Bounded replay buffer. Deliberately in-memory, not durable queuing. */
export const DEVICE_OUTBOX_LIMIT = 100;
export const DEVICE_OUTBOX_TTL_MS = 10 * 60_000;
