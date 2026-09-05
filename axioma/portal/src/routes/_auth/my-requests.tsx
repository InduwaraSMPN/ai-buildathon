import {
	RiAddLine,
	RiArrowDownSLine,
	RiArrowRightLine,
	RiCheckboxCircleLine,
	RiInboxLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BackToHome } from "@/components/back-to-home";
import {
	ErrorState,
	formatDate,
	LoadingCards,
	PageHeading,
	PageShell,
	panelCardClass,
	panelTitleClass,
	StatusBadge,
} from "@/components/ticket-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import {
	type RequestFilter,
	RequestFilters,
} from "@/features/tickets/components/request-filters";
import {
	getTicketStage,
	homeCopy,
	isFinishedTicket,
} from "@/features/tickets/copy";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/my-requests")({
	component: RouteComponent,
	head: () => ({ meta: [{ title: homeCopy.pageTitle }] }),
});

function RouteComponent() {
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<RequestFilter>("All requests");
	const tickets = useQuery(
		orpc.listTickets.queryOptions({
			input: {
				scope: "mine",
				sortBy: "updatedAt",
				sortDirection: "desc",
				limit: 100,
			},
		}),
	);
	const items = tickets.data?.items ?? [];
	const filteredItems = useMemo(() => {
		const search = query.trim().toLocaleLowerCase();
		return items.filter((ticket) => {
			const matchesSearch =
				!search ||
				[
					ticket.title,
					ticket.body,
					ticket.number,
					ticket.serviceName,
					ticket.statusLabel,
				].some((value) => value?.toLocaleLowerCase().includes(search));
			const matchesStatus =
				filter === "All requests" ||
				(filter === "In progress" &&
					["new", "open"].includes(ticket.statusStateType)) ||
				(filter === "Needs you" &&
					["pending", "resolved"].includes(ticket.statusStateType)) ||
				(filter === "Finished" && isFinishedTicket(ticket.statusStateType));
			return matchesSearch && matchesStatus;
		});
	}, [filter, items, query]);
	const activeTickets = filteredItems.filter(
		(ticket) => !isFinishedTicket(ticket.statusStateType),
	);
	const finishedTickets = filteredItems.filter((ticket) =>
		isFinishedTicket(ticket.statusStateType),
	);
	const ticketCard = (ticket: (typeof items)[number]) => (
		<Link
			key={ticket.id}
			to="/tickets/$ticketId"
			params={{ ticketId: ticket.id }}
			className="group flex items-center justify-between gap-4 rounded-2xl border p-5 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring sm:gap-5"
		>
			<div className="min-w-0">
				<div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-3">
					<StatusBadge
						stateType={ticket.statusStateType}
						label={ticket.statusLabel}
					/>
					<span className="font-medium text-muted-foreground text-xs">
						{homeCopy.stage} {getTicketStage(ticket.statusStateType)}
					</span>
					{ticket.statusStateType === "resolved" ? (
						<span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
							<RiCheckboxCircleLine className="size-3.5" aria-hidden="true" />
							<span>{homeCopy.resolutionReady}</span>
						</span>
					) : null}
					<span className="text-muted-foreground text-xs">
						{homeCopy.updated} {formatDate(ticket.updatedAt)}
					</span>
				</div>
				<h3 className="truncate font-semibold text-base">{ticket.title}</h3>
				<p className="mt-1 font-mono text-muted-foreground text-xs">
					{ticket.number ?? ticket.id}
				</p>
				<p className="mt-1 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
					{ticket.body}
				</p>
			</div>
			<RiArrowRightLine
				className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
				aria-hidden="true"
			/>
		</Link>
	);

	const frontDoor = useQuery(orpc.portalIsFrontDoor.queryOptions({}));
	const canCreate = frontDoor.data?.foreign === false;

	return (
		<PageShell>
			<BackToHome />
			<PageHeading
				title={homeCopy.title}
				description={homeCopy.description}
				meta={
					items.length
						? `${filteredItems.length} ${
								filteredItems.length === 1
									? homeCopy.request
									: homeCopy.requestsPlural
							}`
						: undefined
				}
				action={
					// Hidden when the customer's own service desk is the front door:
					// two places to file one request is worse than either alone.
					canCreate ? (
						<Link to="/tickets/new" className={buttonVariants({ size: "lg" })}>
							<RiAddLine data-icon="inline-start" aria-hidden="true" />
							{homeCopy.newRequest}
						</Link>
					) : undefined
				}
			/>

			<Card className={panelCardClass}>
				<CardContent className="flex flex-col gap-5">
					{items.length ? (
						<RequestFilters
							query={query}
							filter={filter}
							resultCount={filteredItems.length}
							onQueryChange={setQuery}
							onFilterChange={setFilter}
						/>
					) : null}

					{tickets.isPending ? <LoadingCards /> : null}
					{tickets.isError ? (
						<ErrorState retry={() => tickets.refetch()} error={tickets.error} />
					) : null}
					{tickets.data && filteredItems.length === 0 ? (
						<Empty className="rounded-2xl border border-dashed py-8">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<RiInboxLine aria-hidden="true" />
								</EmptyMedia>
								<EmptyTitle>
									{items.length ? "No matching requests" : homeCopy.emptyTitle}
								</EmptyTitle>
								<EmptyDescription>
									{items.length
										? "Try a different search or filter."
										: homeCopy.emptyDescription}
								</EmptyDescription>
							</EmptyHeader>
							{items.length ? (
								<EmptyContent>
									<Button
										variant="outline"
										onClick={() => {
											setQuery("");
											setFilter("All requests");
										}}
									>
										Clear filters
									</Button>
								</EmptyContent>
							) : canCreate ? (
								<EmptyContent>
									<Link
										to="/tickets/new"
										className={buttonVariants({ variant: "outline" })}
									>
										{homeCopy.createFirst}
									</Link>
								</EmptyContent>
							) : null}
						</Empty>
					) : null}
					{activeTickets.length ? (
						<section aria-labelledby="active-requests-heading">
							<h3 id="active-requests-heading" className="sr-only">
								{homeCopy.active}
							</h3>
							<div className="grid gap-3.5">
								{activeTickets.map(ticketCard)}
							</div>
						</section>
					) : null}
				</CardContent>
			</Card>

			{finishedTickets.length ? (
				<Card className={cn(panelCardClass, "mt-4 lg:mt-5")}>
					<Collapsible>
						<CardHeader>
							<CardTitle className={panelTitleClass}>
								<CollapsibleTrigger
									render={<Button variant="ghost" size="lg" />}
									className="-ml-2.5"
								>
									{homeCopy.finished} ({finishedTickets.length})
									<RiArrowDownSLine
										data-icon="inline-end"
										aria-hidden="true"
										className="transition-transform group-aria-expanded/button:rotate-180"
									/>
								</CollapsibleTrigger>
							</CardTitle>
						</CardHeader>
						<CollapsibleContent keepMounted>
							<CardContent className="flex flex-col gap-3.5">
								<Separator />
								{finishedTickets.map(ticketCard)}
							</CardContent>
						</CollapsibleContent>
					</Collapsible>
				</Card>
			) : null}
		</PageShell>
	);
}
