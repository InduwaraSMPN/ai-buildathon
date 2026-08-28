import { queryOptions } from "@tanstack/react-query";
import { agentRunsService } from "./service";

export const agentRunQueries = {
	ticket: (ticketId: string) =>
		queryOptions({
			queryKey: ["agent-runs", "ticket", ticketId],
			queryFn: () => agentRunsService.getTicket(ticketId),
		}),
};
