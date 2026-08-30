import type { QueryClient } from "@tanstack/react-query";
import type { orpc } from "@/utils/orpc";

type TicketQueryUtils = Pick<
	typeof orpc,
	"listTickets" | "getTicket" | "listTicketSla"
>;

export function invalidateTicketQueries(
	queryClient: Pick<QueryClient, "invalidateQueries">,
	utils: TicketQueryUtils,
	id: string,
) {
	return Promise.all([
		queryClient.invalidateQueries({ queryKey: utils.listTickets.key() }),
		queryClient.invalidateQueries({
			queryKey: utils.getTicket.key({ input: { id } }),
		}),
		queryClient.invalidateQueries({
			queryKey: utils.listTicketSla.key({ input: { ticketId: id } }),
		}),
	]);
}
