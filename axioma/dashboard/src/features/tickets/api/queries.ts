import { queryOptions } from "@tanstack/react-query";
import { ticketService } from "./service";
import type { TicketScope, TicketStatus } from "./types";

export const ticketKeys = {
	all: ["tickets"] as const,
	list: (scope: TicketScope, status?: TicketStatus) =>
		[...ticketKeys.all, "list", scope, status] as const,
	detail: (id: string) => [...ticketKeys.all, "detail", id] as const,
};

export const ticketQueries = {
	list: (scope: TicketScope = "all", status?: TicketStatus) =>
		queryOptions({
			queryKey: ticketKeys.list(scope, status),
			queryFn: () => ticketService.list({ scope, status }),
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: ticketKeys.detail(id),
			queryFn: () => ticketService.get(id),
		}),
};
