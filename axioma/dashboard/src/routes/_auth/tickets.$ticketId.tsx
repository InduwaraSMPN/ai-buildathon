import { createFileRoute } from "@tanstack/react-router";
import { TicketDetailPage } from "@/features/tickets/components/ticket-detail";

export const Route = createFileRoute("/_auth/tickets/$ticketId")({
	component: RouteComponent,
	beforeLoad: ({ params }) => ({ breadcrumb: `Ticket ${params.ticketId}` }),
	head: () => ({ meta: [{ title: "Ticket detail · Axiōma" }] }),
});

function RouteComponent() {
	const { ticketId } = Route.useParams();
	return <TicketDetailPage ticketId={ticketId} />;
}
