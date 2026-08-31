import { createFileRoute, redirect } from "@tanstack/react-router";
import { EnvironmentsPage } from "@/features/admin/environments-page";

export const Route = createFileRoute("/_auth/admin/environments")({
	beforeLoad: ({ context }) => {
		if (!context.capabilities.includes("admin.environments"))
			throw redirect({ to: "/home" });
		return { breadcrumb: "Environments" };
	},
	component: EnvironmentsPage,
	head: () => ({ meta: [{ title: "Environments · Axiōma" }] }),
});
