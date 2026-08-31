import { createFileRoute } from "@tanstack/react-router";
import { DevicesPage } from "@/features/devices/components/devices-page";
import { requireNav } from "@/lib/navigation";

export const Route = createFileRoute("/_auth/devices")({
	validateSearch: (search: Record<string, unknown>): { deviceId?: string } => ({
		deviceId: typeof search.deviceId === "string" ? search.deviceId : undefined,
	}),
	component: DevicesPage,
	beforeLoad: ({ context }) => {
		requireNav("/devices", context);
		return { breadcrumb: "Devices" };
	},
	head: () => ({ meta: [{ title: "Devices · Axiōma" }] }),
});
