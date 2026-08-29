import type { QueryClient } from "@tanstack/react-query";
import { ticketKeys } from "./queries";
import { ticketService } from "./service";
import type { CreateTicketInput, UpdateTicketInput } from "./types";

type Callbacks<Result> = {
	onSuccess?: (data: Result) => unknown | Promise<unknown>;
	onError?: (error: Error) => unknown;
};

type CreateTicketResult = Awaited<ReturnType<typeof ticketService.create>>;
type UpdateTicketResult = Awaited<ReturnType<typeof ticketService.update>>;

export const ticketMutations = {
	create: (
		queryClient: QueryClient,
		callbacks: Callbacks<CreateTicketResult> = {},
	) => ({
		mutationFn: (input: CreateTicketInput) => ticketService.create(input),
		onSuccess: async (data: CreateTicketResult) => {
			await queryClient.invalidateQueries({ queryKey: ticketKeys.all });
			await callbacks.onSuccess?.(data);
		},
		onError: callbacks.onError,
	}),
	update: (
		queryClient: QueryClient,
		callbacks: Callbacks<UpdateTicketResult> = {},
	) => ({
		mutationFn: (input: UpdateTicketInput) => ticketService.update(input),
		onSuccess: async (data: UpdateTicketResult) => {
			await queryClient.invalidateQueries({ queryKey: ticketKeys.all });
			await callbacks.onSuccess?.(data);
		},
		onError: callbacks.onError,
	}),
};
