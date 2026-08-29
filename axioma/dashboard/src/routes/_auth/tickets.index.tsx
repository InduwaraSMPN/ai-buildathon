import { createFileRoute } from "@tanstack/react-router";
import { normalizeTicketQueueSearch } from "@/features/tickets/components/queue-search";
import { TicketQueuePage } from "@/features/tickets/components/ticket-queue-page";

export const Route = createFileRoute("/_auth/tickets/")({
	validateSearch: normalizeTicketQueueSearch,
	component: TicketQueuePage,
	beforeLoad: () => ({ breadcrumb: "Ticket queue" }),
	head: () => ({ meta: [{ title: "Ticket queue · Axiōma" }] }),
});
