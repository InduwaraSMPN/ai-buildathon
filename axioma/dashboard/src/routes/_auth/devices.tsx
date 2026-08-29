import { createFileRoute } from "@tanstack/react-router";
import { DevicesPage } from "@/features/devices/components/devices-page";

export const Route = createFileRoute("/_auth/devices")({
	validateSearch: (search: Record<string, unknown>): { deviceId?: string } => ({
		deviceId: typeof search.deviceId === "string" ? search.deviceId : undefined,
	}),
	component: DevicesPage,
	beforeLoad: () => ({ breadcrumb: "Devices" }),
	head: () => ({ meta: [{ title: "Devices · Axiōma" }] }),
});
