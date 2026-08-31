import { useQuery } from "@tanstack/react-query";
import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { orpc } from "@/utils/orpc";

/**
 * Shown when the ticket's record lives in the customer's own service desk.
 *
 * The banner explains rather than merely marks. A synced ticket has controls
 * disabled — closing or reopening it here would diverge the two systems — and
 * a disabled control with no stated reason reads as a bug rather than as a
 * boundary.
 */
export function TicketOriginBanner({ ticketId }: { ticketId: string }) {
	const query = useQuery(
		orpc.getTicketConnectorOrigin.queryOptions({ input: { ticketId } }),
	);
	const origin = query.data;
	if (!origin) return null;

	return (
		<Alert>
			<AlertTitle>
				{origin.externalKey} · owned in {origin.connectorLabel}
			</AlertTitle>
			<AlertDescription>
				This ticket was synced from the customer's {origin.vendor} instance and
				is worked here. Closing, reopening, reassigning and reclassifying are
				disabled, because that record's state belongs to the system it came
				from. Axel's findings are posted back there as a work note.
			</AlertDescription>
			{origin.externalUrl ? (
				<AlertAction>
					<Button
						variant="outline"
						size="sm"
						render={
							<a
								href={origin.externalUrl}
								target="_blank"
								rel="noreferrer noopener"
							/>
						}
					>
						Open in {origin.vendor}
					</Button>
				</AlertAction>
			) : null}
		</Alert>
	);
}

/**
 * Whether a ticket's state-changing controls should be disabled here.
 *
 * Exported separately from the banner so the predicate and the explanation
 * cannot drift apart: a caller that disables a control without rendering the
 * banner would produce exactly the unexplained disabled state this is meant to
 * avoid.
 */
export function useForeignOwned(ticketId: string): boolean {
	const query = useQuery(
		orpc.getTicketConnectorOrigin.queryOptions({ input: { ticketId } }),
	);
	return Boolean(query.data);
}
