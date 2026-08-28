import { createFileRoute } from "@tanstack/react-router";
import { TicketQueuePage } from "@/features/tickets/components/ticket-queue-page";

export const Route = createFileRoute("/_auth/tickets/")({
	component: TicketQueuePage,
	head: () => ({ meta: [{ title: "Ticket queue · Axiōma" }] }),
});
