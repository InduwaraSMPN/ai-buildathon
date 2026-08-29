import { queryOptions } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { devicesService } from "./service";

export const deviceQueries = {
	all: () =>
		queryOptions({
			queryKey: ["devices"],
			queryFn: devicesService.list,
			refetchInterval: 5_000,
		}),
	inventory: (deviceId: string) =>
		orpc.readDeviceInventory.queryOptions({ input: { deviceId } }),
	commands: (deviceId: string) =>
		queryOptions({
			queryKey: ["devices", deviceId, "commands"],
			queryFn: () => devicesService.listCommands(deviceId),
			refetchInterval: 5_000,
		}),
};
