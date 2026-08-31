import { createFileRoute } from "@tanstack/react-router";
import { RolesPage } from "@/features/admin/roles-page";
import { requireNav } from "@/lib/navigation";

export const Route = createFileRoute("/_auth/admin/roles")({
	beforeLoad: ({ context }) => {
		requireNav("/admin/roles", context);
		return { breadcrumb: "Roles" };
	},
	component: RolesPage,
	head: () => ({ meta: [{ title: "Roles · Axiōma" }] }),
});
