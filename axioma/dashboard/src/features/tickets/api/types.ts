import type { client } from "@/utils/orpc";

export type Ticket = Awaited<ReturnType<typeof client.listTickets>>[number];
export type TicketDetail = NonNullable<
	Awaited<ReturnType<typeof client.getTicket>>
>;
export type TicketScope = Parameters<typeof client.listTickets>[0]["scope"];
export type TicketStatus = NonNullable<
	Parameters<typeof client.listTickets>[0]["status"]
>;
export type CreateTicketInput = Parameters<typeof client.createTicket>[0];
export type UpdateTicketInput = Parameters<typeof client.updateTicket>[0];
