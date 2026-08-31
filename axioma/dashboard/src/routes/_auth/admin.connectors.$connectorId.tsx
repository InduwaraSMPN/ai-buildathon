import { createFileRoute, redirect } from "@tanstack/react-router";
import { ConnectorDetail } from "@/features/connectors/components/connector-detail";

export const Route = createFileRoute("/_auth/admin/connectors/$connectorId")({
	beforeLoad: ({ context }) => {
		if (!context.capabilities.includes("admin.connectors"))
			throw redirect({ to: "/home" });
		return { breadcrumb: "Connector" };
	},
	component: RouteComponent,
	head: () => ({ meta: [{ title: "Connector · Axiōma" }] }),
});

function RouteComponent() {
	const { connectorId } = Route.useParams();
	return <ConnectorDetail connectorId={connectorId} />;
}
