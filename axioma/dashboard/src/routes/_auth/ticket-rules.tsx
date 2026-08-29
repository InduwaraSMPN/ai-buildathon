import { createFileRoute } from "@tanstack/react-router";
import { TicketRulesPage } from "@/features/automation/components/automation-pages";

export const Route = createFileRoute("/_auth/ticket-rules")({
	component: TicketRulesPage,
	beforeLoad: () => ({ breadcrumb: "Ticket rules" }),
	head: () => ({ meta: [{ title: "Ticket rules · Axiōma" }] }),
});
