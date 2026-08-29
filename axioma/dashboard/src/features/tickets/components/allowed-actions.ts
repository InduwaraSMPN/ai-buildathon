import type { TicketDetail, TicketOperatorAction } from "../api/types";

const stateTones: Record<string, string> = {
	new: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
	open: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
	pending:
		"border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
	resolved:
		"border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
	closed: "border-border bg-muted text-muted-foreground",
};

const actionsByLabel: Record<string, readonly TicketOperatorAction[]> = {
	Open: ["assign", "reclassify", "pend"],
	"Waiting for reply": ["unpend"],
	Routing: ["assign", "reclassify"],
	Resolving: ["resolve", "escalate", "assign", "reclassify"],
	Resolved: ["close", "escalate", "assign", "reclassify"],
	Escalated: ["close", "escalate", "assign", "reclassify"],
	Closed: ["reopen"],
};

export function ticketStatusTone(stateType: string): string | undefined {
	return stateTones[stateType];
}

const actionCapabilities: Record<TicketOperatorAction, string> = {
	resolve: "ticket.resolve",
	close: "ticket.close",
	escalate: "ticket.escalate",
	pend: "ticket.reclassify",
	unpend: "ticket.reclassify",
	assign: "ticket.assign",
	reopen: "ticket.reopen",
	reclassify: "ticket.reclassify",
};

export function allowedActions(
	ticket: Pick<
		TicketDetail,
		"statusLabel" | "statusStateType" | "closedAt" | "reopenedAt"
	>,
	capabilities: readonly string[],
	now = Date.now(),
): readonly TicketOperatorAction[] {
	const actions = actionsByLabel[ticket.statusLabel] ?? [];
	if (
		ticket.statusStateType === "closed" &&
		(!ticket.closedAt ||
			ticket.reopenedAt ||
			now - ticket.closedAt.getTime() > 7 * 24 * 60 * 60 * 1_000)
	)
		return [];
	return actions.filter((action) =>
		capabilities.includes(actionCapabilities[action]),
	);
}
