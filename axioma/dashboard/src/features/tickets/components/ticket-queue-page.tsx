import { useQuery } from "@tanstack/react-query";
import { PageContainer } from "@/components/layout/page-container";
import { ticketQueries } from "../api/queries";
import { TicketQueue } from "./ticket-queue";

export function TicketQueuePage() {
	const query = useQuery(ticketQueries.list("all"));
	return (
		<PageContainer
			title="Ticket queue"
			description="Live service desk requests and Axel’s progress."
		>
			<TicketQueue
				tickets={query.data ?? []}
				isPending={query.isPending}
				error={query.error}
				onRetry={() => query.refetch()}
			/>
		</PageContainer>
	);
}
