import { client } from "@/utils/orpc";
export const devicesService = {
	list: () => client.listDevices(),
	listCommands: (deviceId: string) =>
		client.listDeviceCommands({ deviceId, limit: 20 }),
};
