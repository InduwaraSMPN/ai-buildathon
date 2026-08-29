import type { QueryClient } from "@tanstack/react-query";
import { ticketKeys } from "@/features/tickets/api/queries";
import { agentRunKeys } from "./queries";
import { agentRunsService } from "./service";
import type { CancelRunInput, StartRunInput } from "./types";

type Callbacks = {
	onSuccess?: () => void;
	onError?: (error: Error) => void;
};

const invalidate = async (queryClient: QueryClient) => {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: agentRunKeys.all }),
		queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
	]);
};

export const agentRunMutations = {
	start: (queryClient: QueryClient, callbacks: Callbacks = {}) => ({
		mutationFn: (input: StartRunInput) => agentRunsService.start(input),
		onSuccess: async () => {
			await invalidate(queryClient);
			callbacks.onSuccess?.();
		},
		onError: callbacks.onError,
	}),
	cancel: (queryClient: QueryClient, callbacks: Callbacks = {}) => ({
		mutationFn: (input: CancelRunInput) => agentRunsService.cancel(input),
		onSuccess: async () => {
			await invalidate(queryClient);
			callbacks.onSuccess?.();
		},
		onError: callbacks.onError,
	}),
};
