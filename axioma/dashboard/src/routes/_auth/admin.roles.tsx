import { createFileRoute, redirect } from "@tanstack/react-router";
import { RolesPage } from "@/features/admin/roles-page";

export const Route = createFileRoute("/_auth/admin/roles")({
	beforeLoad: ({ context }) => {
		if (!context.capabilities.includes("admin.roles"))
			throw redirect({ to: "/home" });
		return { breadcrumb: "Roles" };
	},
	component: RolesPage,
	head: () => ({ meta: [{ title: "Roles · Axiōma" }] }),
});
