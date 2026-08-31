import { createFileRoute } from "@tanstack/react-router";
import { TicketRulesPage } from "@/features/automation/components/automation-pages";
import { requireNav } from "@/lib/navigation";

export const Route = createFileRoute("/_auth/ticket-rules")({
	component: TicketRulesPage,
	beforeLoad: ({ context }) => {
		requireNav("/ticket-rules", context);
		return { breadcrumb: "Ticket rules" };
	},
	head: () => ({ meta: [{ title: "Ticket rules · Axiōma" }] }),
});
