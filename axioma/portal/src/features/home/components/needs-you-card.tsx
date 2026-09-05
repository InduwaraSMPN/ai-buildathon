import {
	RiChat3Line,
	RiCheckboxCircleLine,
	RiExternalLinkLine,
} from "@remixicon/react";
import { useMutation, useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
	panelCardClass,
	panelTitleClass,
	timeAgo,
} from "@/components/ticket-ui";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { homeCopy } from "@/features/home/copy";
import { updateMyTicketMutationOptions } from "@/features/tickets/api/mutations";
import { ResolutionActions } from "@/features/tickets/components/resolution-actions";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type Ticket = {
	id: string;
	number: string | null;
	title: string;
	statusStateType: string;
	escalationFlag: "none" | "warning" | "breach";
	resolution: string | null;
	resolvedAt: Date | null;
	updatedAt: Date;
};

export function NeedsYouCard({ tickets }: { tickets: Ticket[] }) {
	const pending = tickets.filter(
		(ticket) => ticket.statusStateType === "pending",
	);
	const details = useQueries({
		queries: pending.map((ticket) =>
			orpc.getMyTicket.queryOptions({ input: { id: ticket.id } }),
		),
	});
	const updateTicket = useMutation({
		...updateMyTicketMutationOptions(),
		onError: () => toast.error(homeCopy.updateError),
	});

	return (
		<Card className={panelCardClass}>
			<CardHeader className="grid-cols-[1fr_auto] items-center">
				<CardTitle className={panelTitleClass}>
					<h2>{homeCopy.needsYouHeading}</h2>
				</CardTitle>
				<Badge variant="secondary">{homeCopy.waiting(tickets.length)}</Badge>
			</CardHeader>
			<CardContent className="flex flex-col gap-3.5">
				{tickets.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{homeCopy.needsYouEmpty}
					</p>
				) : null}
				{tickets.map((ticket) => {
					const resolved = ticket.statusStateType === "resolved";
					const detail = resolved
						? undefined
						: details[pending.findIndex((item) => item.id === ticket.id)]?.data;
					const lastStaffMessage = detail?.messages
						.filter((message) => message.authorType === "staff")
						.at(-1);
					return (
						<article
							key={ticket.id}
							className={cn(
								"flex flex-col gap-4 rounded-2xl border p-5",
								resolved
									? "border-success/30 bg-success/10 text-success"
									: "border-warning/30 bg-warning/10 text-warning",
							)}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="mb-1 flex items-center gap-1.5 font-semibold text-xs">
										{resolved ? (
											<RiCheckboxCircleLine aria-hidden="true" />
										) : (
											<RiChat3Line aria-hidden="true" />
										)}
										{resolved
											? homeCopy.resolutionReady
											: homeCopy.waitingForReply}
									</p>
									<h3 className="font-semibold text-base text-foreground">
										{ticket.title}
									</h3>
								</div>
								<Link
									to="/tickets/$ticketId"
									params={{ ticketId: ticket.id }}
									aria-label={homeCopy.openRequest(ticket.number ?? ticket.id)}
									className={buttonVariants({
										variant: "outline",
										size: "icon-sm",
										className: "shrink-0 bg-card text-foreground",
									})}
								>
									<RiExternalLinkLine aria-hidden="true" />
								</Link>
							</div>
							<p className="whitespace-pre-wrap text-foreground text-sm leading-relaxed">
								{resolved ? (
									ticket.resolution
								) : lastStaffMessage ? (
									<>
										{homeCopy.staffAsked} <q>{lastStaffMessage.body}</q>
									</>
								) : (
									homeCopy.pendingFallback
								)}
							</p>
							<div className="flex flex-wrap items-center justify-between gap-3 text-foreground">
								<span className="text-muted-foreground text-xs">
									{resolved && ticket.resolvedAt
										? `${homeCopy.fixed} ${timeAgo(ticket.resolvedAt)}`
										: timeAgo(lastStaffMessage?.createdAt ?? ticket.updatedAt)}
								</span>
								{resolved ? (
									<ResolutionActions
										ticket={ticket}
										pending={updateTicket.isPending}
										onAction={(input) => updateTicket.mutateAsync(input)}
										className="flex-row-reverse justify-start border-0 p-0"
									/>
								) : (
									<Link
										to="/tickets/$ticketId"
										params={{ ticketId: ticket.id }}
										hash="conversation"
										className={buttonVariants({ size: "sm" })}
									>
										{homeCopy.reply}
									</Link>
								)}
							</div>
						</article>
					);
				})}
			</CardContent>
		</Card>
	);
}
