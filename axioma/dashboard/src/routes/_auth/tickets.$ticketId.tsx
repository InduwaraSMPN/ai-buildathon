import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { TicketDetailPage } from "@/features/tickets/components/ticket-detail";

export const Route = createFileRoute("/_auth/tickets/$ticketId")({
	component: RouteComponent,
	head: () => ({ meta: [{ title: "Ticket detail · Axiōma" }] }),
});

function RouteComponent() {
	const { ticketId } = Route.useParams();
	return (
		<PageContainer
			title="Ticket detail"
			description="Full Axel transcript, evidence, and operator controls."
			action={
				<Link
					to="/tickets"
					className="inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
				>
					<ArrowLeft className="size-3.5" /> Back to queue
				</Link>
			}
		>
			<TicketDetailPage ticketId={ticketId} />
		</PageContainer>
	);
}
