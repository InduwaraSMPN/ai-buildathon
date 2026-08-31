import { createFileRoute } from "@tanstack/react-router";
import { ConnectorDetail } from "@/features/connectors/components/connector-detail";
import { navCrumb, requireNav } from "@/lib/navigation";

export const Route = createFileRoute("/_auth/admin/connectors/$connectorId")({
	beforeLoad: ({ context }) => {
		requireNav("/admin/connectors", context);
		return {
			breadcrumb: [navCrumb("/admin/connectors"), { label: "Connector" }],
		};
	},
	component: RouteComponent,
	head: () => ({ meta: [{ title: "Connector · Axiōma" }] }),
});

function RouteComponent() {
	const { connectorId } = Route.useParams();
	return <ConnectorDetail connectorId={connectorId} />;
}
