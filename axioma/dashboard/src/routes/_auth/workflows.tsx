import { createFileRoute } from "@tanstack/react-router";
import { WorkflowsPage } from "@/features/automation/components/automation-pages";

export const Route = createFileRoute("/_auth/workflows")({
	component: WorkflowsPage,
	beforeLoad: () => ({ breadcrumb: "Workflows" }),
	head: () => ({ meta: [{ title: "Workflows · Axiōma" }] }),
});
