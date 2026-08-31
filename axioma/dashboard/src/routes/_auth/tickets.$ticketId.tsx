import { createFileRoute } from "@tanstack/react-router";
import { TicketDetailPage } from "@/features/tickets/components/ticket-detail";
import { navCrumb } from "@/lib/navigation";

export const Route = createFileRoute("/_auth/tickets/$ticketId")({
	component: RouteComponent,
	beforeLoad: ({ params }) => ({
		breadcrumb: [navCrumb("/tickets"), { label: `Ticket ${params.ticketId}` }],
	}),
	head: () => ({ meta: [{ title: "Ticket detail · Axiōma" }] }),
});

function RouteComponent() {
	const { ticketId } = Route.useParams();
	return <TicketDetailPage ticketId={ticketId} />;
}
