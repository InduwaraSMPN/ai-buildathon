import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ticketStatusTransitions } from "@/db/schema";
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
	| "pend"
	| "unpend"
	| "reclassify"
	| "assign"
	| "add_detail";

export function preserveUndefined<T>(value: T | undefined, current: T): T {
	return value === undefined ? current : value;
}

export function ticketRunOrigin(
	mailOrigin?: string | null,
	channelOrigin?: string | null,
): string {
	return mailOrigin || channelOrigin || "portal";
}

export function canRerun(status: TicketStatus, latestRunStatus?: RunStatus) {
	return (
		status === "escalated" &&
		(latestRunStatus === "failed" || latestRunStatus === "exhausted")
	);
}

/** Runtime resolver for configurable status-transition rows. */
export async function resolveTicketStatus(
	status: TicketStatus,
	action: TicketTransition,
): Promise<TicketStatus> {
	const row = (
		await db
			.select({ toStatus: ticketStatusTransitions.toStatus })
			.from(ticketStatusTransitions)
			.where(
				and(
					eq(ticketStatusTransitions.fromStatus, status),
					eq(ticketStatusTransitions.action, action),
				),
			)
			.limit(1)
	)[0];
	if (!row) throwInvalidTransition(status, action);
	return row.toStatus;
}

function throwInvalidTransition(
	status: TicketStatus,
	action: TicketTransition,
): never {
	throw new ORPCError("CONFLICT", {
		message: `Cannot apply ${action} to ticket in ${status} state`,
	});
}
