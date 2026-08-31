import { createFileRoute, redirect } from "@tanstack/react-router";
import { DevicesPage } from "@/features/devices/components/devices-page";

export const Route = createFileRoute("/_auth/devices")({
	validateSearch: (search: Record<string, unknown>): { deviceId?: string } => ({
		deviceId: typeof search.deviceId === "string" ? search.deviceId : undefined,
	}),
	component: DevicesPage,
	beforeLoad: ({ context }) => {
		if (
			!context.capabilities.includes("device.read") &&
			!context.capabilities.includes("device.enroll")
		)
			throw redirect({ to: "/home" });
		return { breadcrumb: "Devices" };
	},
	head: () => ({ meta: [{ title: "Devices · Axiōma" }] }),
});
