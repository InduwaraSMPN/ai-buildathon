import { client } from "@/utils/orpc";
import type { Device } from "./types";

export const devicesService = {
	list: (): Promise<Device[]> => client.listDevices(),
};
