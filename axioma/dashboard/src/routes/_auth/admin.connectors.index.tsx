import { createFileRoute } from "@tanstack/react-router";
import { ConnectorsPage } from "@/features/connectors/components/connectors-page";
import { requireNav } from "@/lib/navigation";

export const Route = createFileRoute("/_auth/admin/connectors/")({
	beforeLoad: ({ context }) => {
		requireNav("/admin/connectors", context);
		return { breadcrumb: "Connectors" };
	},
	component: ConnectorsPage,
	head: () => ({ meta: [{ title: "ITSM connectors · Axiōma" }] }),
});
