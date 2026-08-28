import { PageContainer } from "@/components/layout/page-container";
import { DevicesTable } from "./devices-table";

export function DevicesPage() {
	return (
		<PageContainer
			title="Devices"
			description="Endpoint connection, assignment, and activity."
		>
			<DevicesTable />
		</PageContainer>
	);
}
