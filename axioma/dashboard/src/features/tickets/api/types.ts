import type { client } from "@/utils/orpc";

export type TicketListInput = Parameters<typeof client.listTickets>[0];
export type TicketListResult = Awaited<ReturnType<typeof client.listTickets>>;
export type Ticket = TicketListResult["items"][number];
export type TicketFacets = TicketListResult["facets"];
export type TicketDetail = NonNullable<
	Awaited<ReturnType<typeof client.getTicket>>
>;
export type TicketScope = TicketListInput["scope"];
export type TicketStatus = NonNullable<TicketListInput["status"]>[number];
export type TicketPriority = NonNullable<TicketListInput["priority"]>[number];
export type TicketRecordType = NonNullable<
	TicketListInput["recordType"]
>[number];
export type TicketCategory = NonNullable<
	NonNullable<TicketListInput["category"]>[number]
>;
export type TicketRoute = NonNullable<
	NonNullable<TicketListInput["route"]>[number]
>;
export type TicketSort = NonNullable<TicketListInput["sortBy"]>;
export type TicketSortDirection = NonNullable<TicketListInput["sortDirection"]>;
export type CreateTicketInput = Parameters<typeof client.createTicket>[0];
export type UpdateTicketInput = Parameters<typeof client.updateTicket>[0];
export type TicketAction = UpdateTicketInput["action"];
export type TicketActionInput<Action extends TicketAction> = Omit<
	Extract<UpdateTicketInput, { action: Action }>,
	"id"
>;
export type TicketOperatorAction = Extract<
	TicketAction,
	| "resolve"
	| "close"
	| "escalate"
	| "assign"
	| "reopen"
	| "reclassify"
	| "pend"
	| "unpend"
>;
export type TicketOperatorActionInput = {
	[Action in TicketOperatorAction]: TicketActionInput<Action>;
}[TicketOperatorAction];
