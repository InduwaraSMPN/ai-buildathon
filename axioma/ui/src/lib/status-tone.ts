import type { RunStatus, StateType } from "@/sdk/shared";

/**
 * Semantic tones carried by the shared `tone` variant on `Badge`.
 *
 * Both apps resolve a status to the same tone here — the dashboard's semantic
 * map (`info`/`warning`/`success`/`destructive`, keyed to `StateType`) is
 * canonical; the portal adopted it.
 */
export type StatusTone =
	| "info"
	| "warning"
	| "success"
	| "destructive"
	| "neutral";

/** Ticket states, keyed by `StateType` so an added state type fails to compile until it is given a tone. */
export const stateTones: Record<StateType, StatusTone> = {
	new: "info",
	open: "warning",
	pending: "warning",
	resolved: "success",
	closed: "neutral",
	merged: "success",
	cancelled: "destructive",
};

export function ticketStatusTone(stateType: StateType): StatusTone {
	return stateTones[stateType];
}

/** Agent run statuses. `resolved` means the run fixed the ticket; the rest follow the run's outcome. */
export const runStatusTones: Record<RunStatus, StatusTone> = {
	running: "info",
	resolved: "success",
	escalated: "warning",
	failed: "destructive",
	exhausted: "warning",
};

export function runStatusTone(status: RunStatus): StatusTone {
	return runStatusTones[status];
}

/** Ticket escalation flags. `none` means no escalation surface renders at all. */
export const escalationTones = {
	warning: "warning",
	breach: "destructive",
} as const satisfies Record<string, StatusTone>;
