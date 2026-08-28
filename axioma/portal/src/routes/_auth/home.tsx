import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Inbox, Plus } from "lucide-react";
import {
	ErrorState,
	formatDate,
	LoadingCards,
	PageHeading,
	PageShell,
	StatusBadge,
} from "@/components/ticket-ui";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/home")({
	component: RouteComponent,
	head: () => ({ meta: [{ title: "My requests · Axioma" }] }),
});

function RouteComponent() {
	const { session } = Route.useRouteContext();
	const tickets = useQuery(
		orpc.listTickets.queryOptions({ input: { scope: "mine" } }),
	);
	const firstName = session.data?.user.name?.split(" ")[0];

	return (
		<PageShell>
			<PageHeading
				eyebrow="Employee support"
				title={
					firstName ? `Good to see you, ${firstName}` : "Your support requests"
				}
				description="Ask for help, see what’s happening, and return to your work with confidence."
				action={
					<Link to="/tickets/new" className={buttonVariants({ size: "lg" })}>
						<Plus aria-hidden="true" /> New request
					</Link>
				}
			/>

			<div className="mb-4 flex items-center justify-between">
				<h2 className="font-semibold text-lg">Your requests</h2>
				{tickets.data?.length ? (
					<p className="text-muted-foreground text-sm">
						{tickets.data.length}{" "}
						{tickets.data.length === 1 ? "request" : "requests"}
					</p>
				) : null}
			</div>

			{tickets.isPending ? <LoadingCards /> : null}
			{tickets.isError ? <ErrorState retry={() => tickets.refetch()} /> : null}
			{tickets.data?.length === 0 ? (
				<Card className="rounded-xl border-dashed bg-transparent">
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Inbox aria-hidden="true" />
							</EmptyMedia>
							<EmptyTitle>No requests yet</EmptyTitle>
							<EmptyDescription>
								When something gets in the way of your work, start here. We’ll
								keep every update in one place.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Link to="/tickets/new" className={buttonVariants()}>
								Create your first request
							</Link>
						</EmptyContent>
					</Empty>
				</Card>
			) : null}
			{tickets.data?.length ? (
				<div className="grid gap-4">
					{tickets.data.map((ticket) => (
						<Link
							key={ticket.id}
							to="/tickets/$ticketId"
							params={{ ticketId: ticket.id }}
							className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<Card className="rounded-xl transition-colors group-hover:bg-muted/40">
								<CardContent className="flex items-center justify-between gap-5 py-1">
									<div className="min-w-0">
										<div className="mb-3 flex flex-wrap items-center gap-3">
											<StatusBadge status={ticket.status} />
											<span className="text-muted-foreground text-xs">
												Updated {formatDate(ticket.updatedAt)}
											</span>
										</div>
										<h3 className="truncate font-semibold text-base">
											{ticket.title}
										</h3>
										<p className="mt-1 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
											{ticket.body}
										</p>
									</div>
									<ArrowRight
										className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
										aria-hidden="true"
									/>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			) : null}
		</PageShell>
	);
}
