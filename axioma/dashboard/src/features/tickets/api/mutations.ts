import type { QueryClient } from "@tanstack/react-query";
import { ticketKeys } from "./queries";
import { ticketService } from "./service";
import type { CreateTicketInput, UpdateTicketInput } from "./types";

export const ticketMutations = {
	create: (queryClient: QueryClient) => ({
		mutationFn: (input: CreateTicketInput) => ticketService.create(input),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
	}),
	update: (queryClient: QueryClient) => ({
		mutationFn: (input: UpdateTicketInput) => ticketService.update(input),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
	}),
};
