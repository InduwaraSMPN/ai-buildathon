import { createFileRoute } from "@tanstack/react-router";
import { WorkflowsPage } from "@/features/automation/components/automation-pages";
import { requireNav } from "@/lib/navigation";

export const Route = createFileRoute("/_auth/workflows")({
	component: WorkflowsPage,
	beforeLoad: ({ context }) => {
		requireNav("/workflows", context);
		return { breadcrumb: "Workflows" };
	},
	head: () => ({ meta: [{ title: "Workflows · Axiōma" }] }),
});
