import { queryOptions } from "@tanstack/react-query";
import { ticketService } from "./service";
import type { TicketListInput } from "./types";

export const ticketKeys = {
	all: ["tickets"] as const,
	list: (input: TicketListInput) => [...ticketKeys.all, "list", input] as const,
	detail: (id: string) => [...ticketKeys.all, "detail", id] as const,
	sla: (id: string) => [...ticketKeys.all, "sla", id] as const,
};

export const ticketQueries = {
	list: (input: TicketListInput) =>
		queryOptions({
			queryKey: ticketKeys.list(input),
			queryFn: () => ticketService.list(input),
			refetchInterval: () =>
				typeof document === "undefined" ||
				document.visibilityState === "visible"
					? 15_000
					: false,
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: ticketKeys.detail(id),
			queryFn: () => ticketService.get(id),
		}),
	sla: (id: string) =>
		queryOptions({
			queryKey: ticketKeys.sla(id),
			queryFn: () => ticketService.sla(id),
			refetchInterval: () =>
				typeof document === "undefined" ||
				document.visibilityState === "visible"
					? 15_000
					: false,
		}),
};
