import type {
	TicketDetail,
	TicketOperatorAction,
	TicketStatus,
} from "../api/types";

const statusConfig: Record<
	TicketStatus,
	{ tone: string; actions: readonly TicketOperatorAction[] }
> = {
	open: {
		tone: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
		actions: ["assign", "reclassify"],
	},
	routing: {
		tone: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
		actions: ["assign", "reclassify"],
	},
	resolving: {
		tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
		actions: ["resolve", "escalate", "assign", "reclassify"],
	},
	resolved: {
		tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
		actions: ["close", "escalate", "assign", "reclassify"],
	},
	escalated: {
		tone: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
		actions: ["close", "escalate", "assign", "reclassify"],
	},
	closed: {
		tone: "border-border bg-muted text-muted-foreground",
		actions: ["reopen"],
	},
} as const;

export function ticketStatusTone(status: string): string | undefined {
	return statusConfig[status as TicketStatus]?.tone;
}

export function allowedActions(
	ticket: Pick<TicketDetail, "status" | "closedAt" | "reopenedAt">,
	now = Date.now(),
): readonly TicketOperatorAction[] {
	const actions = statusConfig[ticket.status].actions;
	if (
		ticket.status !== "closed" ||
		!ticket.closedAt ||
		ticket.reopenedAt ||
		now - ticket.closedAt.getTime() > 7 * 24 * 60 * 60 * 1_000
	)
		return ticket.status === "closed" ? [] : actions;
	return actions;
}
