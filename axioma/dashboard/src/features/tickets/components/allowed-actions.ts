import type { StateType } from "../../../sdk/shared";
import type { TicketDetail, TicketOperatorAction } from "../api/types";

const actionsByState: Record<StateType, readonly TicketOperatorAction[]> = {
	new: ["assign", "reclassify", "pend"],
	open: ["resolve", "escalate", "assign", "reclassify"],
	pending: ["unpend"],
	resolved: ["close", "escalate", "assign", "reclassify"],
	closed: ["reopen"],
	merged: [],
	cancelled: [],
};

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
