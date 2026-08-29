import { ORPCError } from "@orpc/server";
import type { RunStatus, TicketStatus } from "@/shared";

export type TicketTransition =
	| "startRun"
	| "firstTool"
	| "resolve"
	| "escalate"
	| "fail"
	| "exhaust"
	| "close"
	| "reopen"
	| "reclassify"
	| "assign"
	| "add_detail";

const transitions: Record<
	TicketStatus,
	Partial<Record<TicketTransition, TicketStatus>>
> = {
	open: {
		startRun: "routing",
		reclassify: "open",
		assign: "open",
		add_detail: "open",
	},
	routing: {
		firstTool: "resolving",
		reclassify: "routing",
		assign: "routing",
		add_detail: "routing",
	},
	resolving: {
		resolve: "resolved",
		reclassify: "resolving",
		assign: "resolving",
		add_detail: "resolving",
		escalate: "escalated",
		fail: "escalated",
		exhaust: "escalated",
	},
	resolved: {
		close: "closed",
		escalate: "escalated",
		reclassify: "resolved",
		assign: "resolved",
	},
	escalated: {
		startRun: "routing",
		close: "closed",
		escalate: "escalated",
		reclassify: "escalated",
		assign: "escalated",
	},
	closed: { reopen: "open" },
};

export function preserveUndefined<T>(value: T | undefined, current: T): T {
	return value === undefined ? current : value;
}

export function canRerun(status: TicketStatus, latestRunStatus?: RunStatus) {
	return (
		status === "escalated" &&
		(latestRunStatus === "failed" || latestRunStatus === "exhausted")
	);
}

export function nextTicketStatus(
	status: TicketStatus,
	action: TicketTransition,
): TicketStatus {
	const next = transitions[status][action];
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: `Cannot apply ${action} to ticket in ${status} state`,
		});
	}
	return next;
}
