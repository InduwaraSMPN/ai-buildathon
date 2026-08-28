import { client } from "@/utils/orpc";
import type { TicketAgentRuns } from "./types";

export const agentRunsService = {
	async getTicket(ticketId: string): Promise<TicketAgentRuns | null> {
		const ticket = await client.getTicket({ id: ticketId });
		return ticket ? { id: ticket.id, runs: ticket.runs } : null;
	},
};
