// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

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

export const USER_KINDS = ["staff", "reporter"] as const;
export type UserKind = (typeof USER_KINDS)[number];

export const CAPABILITIES = [
	"ticket.read.own",
	"ticket.read.all",
	"ticket.create",
	"ticket.update",
	"ticket.resolve",
	"ticket.close",
	"ticket.escalate",
	"ticket.reclassify",
	"ticket.assign",
	"ticket.reopen",
	"run.start",
	"run.cancel",
	"run.read",
	"device.read",
	"device.enroll",
	"device.command",
	// Authorising a device to run something is a different act from issuing a
	// typed action, and is deliberately held by a different role.
	"device.approve",
	"stats.read",
	"problem.manage",
	"change.manage",
	"change.approve",
	"knowledge.read",
	"knowledge.manage",
	"approval.read",
	"approval.decide",
	"catalogue.manage",
	"admin.roles",
	"admin.settings",
	"admin.environments",
	"admin.connectors",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const STATE_TYPES = [
	"new",
	"open",
	"pending",
	"resolved",
	"closed",
	"merged",
	"cancelled",
] as const;
export type StateType = (typeof STATE_TYPES)[number];

/** Seed keys only. Status keys are runtime vocabulary and cross boundaries as strings. */
export type TicketStatus = string;

export const RESOLUTION_CODES = [
	"fixed",
	"workaround",
	"not_reproducible",
	"duplicate",
	"no_action_required",
	"rejected",
] as const;
export type ResolutionCode = (typeof RESOLUTION_CODES)[number];

export const RECORD_TYPES = ["incident", "service_request"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const IMPACT_LEVELS = ["high", "medium", "low"] as const;
export type Impact = (typeof IMPACT_LEVELS)[number];

export const URGENCY_LEVELS = ["high", "medium", "low"] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

export const PRIORITIES = ["P1", "P2", "P3", "P4"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PROGRESS_MARKERS = [
	"gathering_evidence",
	"checking_device",
	"checking_service",
	"applying_fix",
	"verifying_fix",
	"handing_to_person",
] as const;
export type ProgressMarker = (typeof PROGRESS_MARKERS)[number];

const PRIORITY_MATRIX = {
	high: { high: "P1", medium: "P2", low: "P3" },
	medium: { high: "P2", medium: "P3", low: "P4" },
	low: { high: "P3", medium: "P4", low: "P4" },
} as const satisfies Record<Impact, Record<Urgency, Priority>>;

export function derivePriority(impact: Impact, urgency: Urgency): Priority {
	return PRIORITY_MATRIX[impact][urgency];
}

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
	"terminal",
] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const EVIDENCE_TONES = [
	"success",
	"warning",
	"destructive",
	"neutral",
] as const;
export type EvidenceTone = (typeof EVIDENCE_TONES)[number];

export const DEVICE_CONNECTION_STATES = ["online", "offline"] as const;
export type DeviceConnectionState = (typeof DEVICE_CONNECTION_STATES)[number];

/**
 * A proposed device command awaiting a human decision.
 *
 * `dispatched` is terminal for the proposal: dispatch consumes it, so one
 * approval can authorise exactly one execution.
 */
export const DEVICE_PROPOSAL_STATUSES = [
	"proposed",
	"approved",
	"rejected",
	"expired",
	"dispatched",
] as const;

export type DeviceProposalStatus = (typeof DEVICE_PROPOSAL_STATUSES)[number];

export const COMMAND_STATUSES = [
	"pending",
	"dispatched",
	"succeeded",
	"failed",
	"timed_out",
	"indeterminate",
] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

/**
 * The statuses a device may name for itself on a finished command. `pending`
 * and `dispatched` describe work still in flight, so a result message — which
 * is terminal by definition — can never report them.
 */
export const TERMINAL_COMMAND_STATUSES = [
	"succeeded",
	"failed",
	"timed_out",
	"indeterminate",
] as const satisfies readonly CommandStatus[];

/** ITSM connector vocabulary. Shared so contracts and schema cannot drift. */
export const ITSM_VENDORS = ["servicenow"] as const;
export type ItsmVendor = (typeof ITSM_VENDORS)[number];

export const ITSM_SYNC_MODES = ["preview", "apply"] as const;
export type ItsmSyncMode = (typeof ITSM_SYNC_MODES)[number];

export const ITSM_SYNC_STATUSES = ["completed", "rejected", "failed"] as const;
export type ItsmSyncStatus = (typeof ITSM_SYNC_STATUSES)[number];

/** Every dispatch decision is explained, as `mailbox_activity_log` explains mail. */
export const ITSM_DISPATCH_OUTCOMES = [
	"dispatched",
	"deferred_no_worker",
	"refused",
] as const;
export type ItsmDispatchOutcome = (typeof ITSM_DISPATCH_OUTCOMES)[number];

export const ITSM_WRITEBACK_STATUSES = [
	"pending",
	"delivering",
	"succeeded",
	"retrying",
	"failed",
] as const;
export type ItsmWritebackStatus = (typeof ITSM_WRITEBACK_STATUSES)[number];

export const ITSM_UNMAPPED_POLICIES = [
	"reject",
	"default",
	"quarantine",
] as const;
export type ItsmUnmappedPolicy = (typeof ITSM_UNMAPPED_POLICIES)[number];

/**
 * Fields a connector mapping may target. `priority` is deliberately absent —
 * it is derived from impact and urgency by `derivePriority`, so offering it
 * would let an administrator configure something the system cannot honour.
 */
export const ITSM_MAPPABLE_FIELDS = [
	"recordType",
	"impact",
	"urgency",
	"status",
	"serviceId",
	"serviceSubcategoryId",
] as const;
export type ItsmMappableField = (typeof ITSM_MAPPABLE_FIELDS)[number];

export const ITSM_PROPOSAL_VERDICTS = ["accepted", "rejected"] as const;
export type ItsmProposalVerdict = (typeof ITSM_PROPOSAL_VERDICTS)[number];
