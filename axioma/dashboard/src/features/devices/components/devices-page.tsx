import { useNavigate } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/page-container";
import { Route } from "@/routes/_auth/devices";
import { DevicesTable } from "./devices-table";

export function DevicesPage() {
	const { deviceId } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const selectDevice = (selectedDeviceId?: string) =>
		void navigate({
			search: selectedDeviceId ? { deviceId: selectedDeviceId } : {},
			replace: true,
		});

	return (
		<PageContainer
			title="Devices"
			description="Endpoint connection, assignment, and activity."
		>
			<DevicesTable deviceId={deviceId} onSelectDevice={selectDevice} />
		</PageContainer>
	);
}
