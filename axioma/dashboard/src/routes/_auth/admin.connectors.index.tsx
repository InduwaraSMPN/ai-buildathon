import { createFileRoute, redirect } from "@tanstack/react-router";
import { ConnectorsPage } from "@/features/connectors/components/connectors-page";

export const Route = createFileRoute("/_auth/admin/connectors/")({
	beforeLoad: ({ context }) => {
		if (!context.capabilities.includes("admin.connectors"))
			throw redirect({ to: "/home" });
		return { breadcrumb: "Connectors" };
	},
	component: ConnectorsPage,
	head: () => ({ meta: [{ title: "ITSM connectors · Axiōma" }] }),
});
