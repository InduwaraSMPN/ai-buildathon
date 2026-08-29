import { orpc, queryClient } from "@/utils/orpc";

export const updateMyTicketMutationOptions = () =>
	orpc.updateTicket.mutationOptions({
		onSuccess: async (_ticket, input) => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.getMyTicket.key({ input: { id: input.id } }),
				}),
				queryClient.invalidateQueries({ queryKey: orpc.listTickets.key() }),
			]);
		},
	});
