import { createFileRoute } from "@tanstack/react-router";
import { EnvironmentsPage } from "@/features/admin/environments-page";
import { requireNav } from "@/lib/navigation";

export const Route = createFileRoute("/_auth/admin/environments")({
	beforeLoad: ({ context }) => {
		requireNav("/admin/environments", context);
		return { breadcrumb: "Environments" };
	},
	component: EnvironmentsPage,
	head: () => ({ meta: [{ title: "Environments · Axiōma" }] }),
});
