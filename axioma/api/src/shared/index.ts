/**
 * Domain vocabulary shared across services.
 *
 * Procedure inputs and outputs live in `src/contracts`. What lives here is the
 * vocabulary those procedures are written in — states, routes, outcomes — shared
 * across the TypeScript half of the system.
 *
 * The device and agent wire formats are NOT here. Those cross a language
 * boundary and live in `proto/axioma.proto`, which generates Go and Python
 * bindings from the same source.
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
