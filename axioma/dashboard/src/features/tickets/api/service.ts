import { client } from "@/utils/orpc";
import type {
	CreateTicketInput,
	TicketScope,
	TicketStatus,
	UpdateTicketInput,
} from "./types";

export const ticketService = {
	list: (input: { scope: TicketScope; status?: TicketStatus }) =>
		client.listTickets(input),
	get: (id: string) => client.getTicket({ id }),
	create: (input: CreateTicketInput) => client.createTicket(input),
	update: (input: UpdateTicketInput) => client.updateTicket(input),
};
