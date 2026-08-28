import { queryOptions } from "@tanstack/react-query";
import { devicesService } from "./service";

export const deviceQueries = {
	all: () =>
		queryOptions({
			queryKey: ["devices"],
			queryFn: devicesService.list,
		}),
};
