import { RiAddLine, RiInboxLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	panelCardClass,
	panelTitleClass,
	StatusBadge,
	timeAgo,
} from "@/components/ticket-ui";
import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StageBar } from "@/features/home/components/stage-bar";
import { type HomeFilter, homeCopy } from "@/features/home/copy";
import {
	getProgressMarkerCopy,
	isFinishedTicket,
} from "@/features/tickets/copy";
import { cn } from "@/lib/utils";

type Ticket = {
	id: string;
	number: string | null;
	title: string;
	serviceName: string;
	statusLabel: string;
	statusStateType: string;
	progressMarker: string | null;
	updatedAt: Date;
};

const matchesFilter = (ticket: Ticket, filter: HomeFilter) =>
	filter === "all" ||
	(filter === "needsYou" &&
		["pending", "resolved"].includes(ticket.statusStateType)) ||
	(filter === "inProgress" &&
		["new", "open"].includes(ticket.statusStateType)) ||
	(filter === "done" && isFinishedTicket(ticket.statusStateType));

export function RequestListCard({
	tickets,
	truncated,
	canCreate,
}: {
	tickets: Ticket[];
	truncated: boolean;
	canCreate: boolean;
}) {
	const [filter, setFilter] = useState<HomeFilter>("all");
	const counts = Object.fromEntries(
		(Object.keys(homeCopy.filters) as HomeFilter[]).map((key) => [
			key,
			tickets.filter((ticket) => matchesFilter(ticket, key)).length,
		]),
	) as Record<HomeFilter, number>;
	const visible = tickets
		.filter((ticket) => matchesFilter(ticket, filter))
		.slice(0, 3);

	return (
		<Card className={cn(panelCardClass, "h-full")}>
			<CardHeader>
				<CardTitle className={panelTitleClass}>
					<h2>{homeCopy.requestsHeading}</h2>
				</CardTitle>
				{canCreate ? (
					<CardAction>
						<Link to="/tickets/new" className={buttonVariants({ size: "lg" })}>
							<RiAddLine data-icon="inline-start" aria-hidden="true" />
							{homeCopy.newRequest}
						</Link>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-5">
				<ToggleGroup
					value={[filter]}
					onValueChange={(value) =>
						value[0] && setFilter(value[0] as HomeFilter)
					}
					aria-label={homeCopy.filtersLabel}
					className="flex w-full flex-wrap justify-start gap-2"
				>
					{(Object.entries(homeCopy.filters) as [HomeFilter, string][]).map(
						([key, label]) => (
							<ToggleGroupItem
								key={key}
								value={key}
								variant="outline"
								className="rounded-full px-4 data-pressed:border-foreground data-pressed:bg-foreground data-pressed:text-background"
							>
								{label}{" "}
								<span className="text-xs opacity-70">{counts[key]}</span>
							</ToggleGroupItem>
						),
					)}
				</ToggleGroup>

				{tickets.length === 0 ? (
					<Empty className="flex-1 py-8">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<RiInboxLine aria-hidden="true" />
							</EmptyMedia>
							<EmptyTitle>{homeCopy.emptyTitle}</EmptyTitle>
							<EmptyDescription>{homeCopy.emptyDescription}</EmptyDescription>
						</EmptyHeader>
						{canCreate ? (
							<EmptyContent>
								<Link to="/tickets/new" className={buttonVariants()}>
									{homeCopy.createFirst}
								</Link>
							</EmptyContent>
						) : null}
					</Empty>
				) : visible.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						{homeCopy.noFilteredRequests}
					</p>
				) : (
					<div className="flex flex-col">
						{visible.map((ticket, index) => (
							<article
								key={ticket.id}
								className={
									index
										? "flex flex-col gap-3 border-t py-5"
										: "flex flex-col gap-3 pb-5"
								}
							>
								<div className="flex items-start justify-between gap-3">
									<h3 className="min-w-0 font-medium text-base">
										<Link
											to="/tickets/$ticketId"
											params={{ ticketId: ticket.id }}
											className="hover:underline focus-visible:underline"
										>
											{ticket.title}
										</Link>
									</h3>
									<StatusBadge
										stateType={ticket.statusStateType}
										label={ticket.statusLabel}
									/>
								</div>
								<p className="text-muted-foreground text-sm">
									{ticket.serviceName}
								</p>
								<div className="flex flex-wrap justify-between gap-2 text-muted-foreground text-sm">
									<span>
										{homeCopy.updated} {timeAgo(ticket.updatedAt)}
									</span>
									{getProgressMarkerCopy(ticket.progressMarker) ? (
										<span>{getProgressMarkerCopy(ticket.progressMarker)}</span>
									) : null}
								</div>
								<StageBar stateType={ticket.statusStateType} />
							</article>
						))}
					</div>
				)}

				<Link
					to="/my-requests"
					className={buttonVariants({
						variant: "outline",
						size: "lg",
						className: "mt-auto w-full",
					})}
				>
					{truncated ? homeCopy.viewAll : homeCopy.viewAllCount(tickets.length)}
				</Link>
			</CardContent>
		</Card>
	);
}
