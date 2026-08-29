import { orpc } from "@/utils/orpc";

export const myTicketQueryOptions = (id: string) =>
	orpc.getMyTicket.queryOptions({
		input: { id },
		refetchInterval: (query) =>
			["new", "open", "pending"].includes(
				query.state.data?.statusStateType ?? "",
			)
				? 5_000
				: false,
		refetchIntervalInBackground: false,
	});
