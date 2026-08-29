import { Check } from "lucide-react";
import { formatDate } from "@/components/ticket-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolutionCopy } from "@/features/tickets/copy";

type TicketAction =
	| { id: string; action: "close" }
	| { id: string; action: "reopen" }
	| { id: string; action: "escalate"; note: string };

export function ResolutionCard({
	ticket,
}: {
	ticket: {
		statusStateType: string;
		escalationFlag: "none" | "warning" | "breach";
		resolution: string | null;
		resolvedAt: Date | null;
		closedAt: Date | null;
	};
	pending: boolean;
	onAction: (input: TicketAction) => void;
}) {
	if (ticket.statusStateType === "closed") {
		return (
			<Card className="rounded-xl">
				<CardHeader>
					<CardTitle>{resolutionCopy.closedTitle}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-1 text-muted-foreground text-sm">
					{ticket.resolvedAt ? (
						<p>
							{resolutionCopy.fixed} {formatDate(ticket.resolvedAt)}
						</p>
					) : null}
					{ticket.closedAt ? (
						<p>
							{resolutionCopy.confirmedClosed} {formatDate(ticket.closedAt)}
						</p>
					) : null}
				</CardContent>
			</Card>
		);
	}

	if (ticket.statusStateType !== "resolved" && ticket.escalationFlag === "none")
		return null;

	return (
		<Card className="rounded-xl border-emerald-500/20 bg-emerald-500/5">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Check className="size-5 text-emerald-600" aria-hidden="true" />
					{ticket.statusStateType === "resolved"
						? resolutionCopy.resolvedTitle
						: resolutionCopy.escalatedTitle}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-5">
				{ticket.resolution ? (
					<p className="whitespace-pre-wrap text-sm leading-7">
						{ticket.resolution}
					</p>
				) : null}
				{ticket.escalationFlag !== "none" ? (
					<p className="text-muted-foreground text-sm leading-6">
						{resolutionCopy.escalatedDescription}
					</p>
				) : null}
				{ticket.resolvedAt ? (
					<p className="text-muted-foreground text-xs">
						{resolutionCopy.fixed} {formatDate(ticket.resolvedAt)}
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}
