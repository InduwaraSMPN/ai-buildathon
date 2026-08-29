import type { client } from "@/utils/orpc";

export type Device = Awaited<ReturnType<typeof client.listDevices>>[number];
export type DeviceCommand = Awaited<
	ReturnType<typeof client.listDeviceCommands>
>[number];
