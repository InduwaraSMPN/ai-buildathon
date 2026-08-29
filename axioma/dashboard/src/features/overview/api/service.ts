import { client } from "@/utils/orpc";

export const overviewService = {
	stats: (days: number) => client.ticketStats({ days }),
};
