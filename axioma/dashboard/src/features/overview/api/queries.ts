import { queryOptions } from "@tanstack/react-query";
import { overviewService } from "./service";

export const overviewQueries = {
	stats: (days = 30) =>
		queryOptions({
			queryKey: ["overview", "ticket-stats", days],
			queryFn: () => overviewService.stats(days),
		}),
};
