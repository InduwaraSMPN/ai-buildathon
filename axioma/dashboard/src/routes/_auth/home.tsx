import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/features/overview/components/overview-page";

export const Route = createFileRoute("/_auth/home")({
	component: OverviewPage,
	beforeLoad: () => ({ breadcrumb: "Overview" }),
	head: () => ({ meta: [{ title: "Overview · Axiōma" }] }),
});
