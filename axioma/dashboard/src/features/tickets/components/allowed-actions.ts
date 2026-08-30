import type { StateType } from "../../../sdk/shared";
import type { TicketDetail, TicketOperatorAction } from "../api/types";

const stateTones: Record<StateType, string> = {
	new: "border-info/30 bg-info/10 text-info-foreground",
	open: "border-warning/30 bg-warning/10 text-warning-foreground",
	pending: "border-warning/30 bg-warning/10 text-warning-foreground",
	resolved: "border-success/30 bg-success/10 text-success-foreground",
	closed: "border-border bg-muted text-muted-foreground",
	merged: "border-success/30 bg-success/10 text-success-foreground",
	cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

const actionsByState: Record<StateType, readonly TicketOperatorAction[]> = {
	new: ["assign", "reclassify", "pend"],
	open: ["resolve", "escalate", "assign", "reclassify"],
	pending: ["unpend"],
	resolved: ["close", "escalate", "assign", "reclassify"],
	closed: ["reopen"],
	merged: [],
	cancelled: [],
};

export function ticketStatusTone(stateType: string): string | undefined {
	return stateTones[stateType as StateType];
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
	ticket: Pick<TicketDetail, "statusStateType" | "closedAt" | "reopenedAt">,
	capabilities: readonly string[],
	now = Date.now(),
): readonly TicketOperatorAction[] {
	const stateType = ticket.statusStateType as StateType;
	const actions = actionsByState[stateType] ?? [];
	if (
		stateType === "closed" &&
		(!ticket.closedAt ||
			ticket.reopenedAt ||
			now - ticket.closedAt.getTime() > 7 * 24 * 60 * 60 * 1_000)
	)
		return [];
	return actions.filter((action) =>
		capabilities.includes(actionCapabilities[action]),
	);
}
