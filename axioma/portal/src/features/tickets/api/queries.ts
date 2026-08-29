import { orpc } from "@/utils/orpc";

export const myTicketQueryOptions = (id: string) =>
	orpc.getMyTicket.queryOptions({
		input: { id },
		refetchInterval: (query) =>
			query.state.data?.status === "routing" ||
			query.state.data?.status === "resolving"
				? 5_000
				: false,
		refetchIntervalInBackground: false,
	});
