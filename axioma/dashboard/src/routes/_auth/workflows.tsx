import { createFileRoute, redirect } from "@tanstack/react-router";
import { WorkflowsPage } from "@/features/automation/components/automation-pages";

export const Route = createFileRoute("/_auth/workflows")({
	component: WorkflowsPage,
	beforeLoad: ({ context }) => {
		if (!context.capabilities.includes("admin.settings"))
			throw redirect({ to: "/home" });
		return { breadcrumb: "Workflows" };
	},
	head: () => ({ meta: [{ title: "Workflows · Axiōma" }] }),
});
