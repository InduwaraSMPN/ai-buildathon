import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
	PageHeader,
	PageState,
	StatusBadge,
	timeAgo,
} from "@/components/support-ui";
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/home")({ component: TicketQueue });

const statuses = [
	"all",
	"open",
	"routing",
	"resolving",
	"resolved",
	"escalated",
	"closed",
] as const;
type Status = (typeof statuses)[number];

function TicketQueue() {
	const [status, setStatus] = useState<Status>("all");
	const [search, setSearch] = useState("");
	const query = useQuery(
		orpc.listTickets.queryOptions({ input: { scope: "all" } }),
	);
	const tickets = useMemo(() => {
		const needle = search.trim().toLowerCase();
		return (query.data ?? []).filter(
			(ticket) =>
				(status === "all" || ticket.status === status) &&
				(!needle ||
					`${ticket.id} ${ticket.title} ${ticket.reporterName} ${ticket.route ?? ""}`
						.toLowerCase()
						.includes(needle)),
		);
	}, [query.data, search, status]);
	const active = (query.data ?? []).filter(
		(ticket) => !["closed", "resolved"].includes(ticket.status),
	).length;
	const escalated = (query.data ?? []).filter(
		(ticket) => ticket.status === "escalated",
	).length;

	return (
		<main className="mx-auto w-full max-w-[1600px] overflow-auto p-4 lg:p-6">
			<PageHeader
				eyebrow="Service desk / live queue"
				title="Ticket queue"
				description="Triage, route, and resolve employee support requests."
			/>
			<section
				className="grid grid-cols-3 border-x border-b"
				aria-label="Queue overview"
			>
				<Stat label="Total" value={query.data?.length ?? 0} />
				<Stat label="Active" value={active} />
				<Stat label="Escalated" value={escalated} alert={escalated > 0} />
			</section>
			<div className="mt-5 flex flex-col gap-3 border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
				<fieldset className="flex flex-wrap gap-1">
					<legend className="sr-only">Filter by status</legend>
					{statuses.map((item) => (
						<button
							key={item}
							type="button"
							onClick={() => setStatus(item)}
							aria-pressed={status === item}
							className="border px-2.5 py-1.5 text-[10px] uppercase tracking-wider hover:bg-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground"
						>
							{item}
						</button>
					))}
				</fieldset>
				<label
					htmlFor="ticket-search"
					className="relative block w-full lg:w-72"
				>
					<span className="sr-only">Search tickets</span>
					<Search className="absolute top-2 left-2.5 size-3.5 text-muted-foreground" />
					<Input
						id="ticket-search"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search ID, reporter, route…"
						className="pl-8"
					/>
				</label>
			</div>
			<div className="mt-3">
				{query.isPending ? (
					<PageState
						kind="loading"
						title="Loading queue"
						description="Fetching the latest support tickets…"
					/>
				) : query.isError ? (
					<PageState
						kind="error"
						title="Queue unavailable"
						description={query.error.message}
						onRetry={() => query.refetch()}
					/>
				) : tickets.length === 0 ? (
					<PageState
						kind="empty"
						title="No matching tickets"
						description="Change the status or search filter to widen the queue."
					/>
				) : (
					<div className="overflow-x-auto border bg-card">
						<table className="w-full min-w-[900px] border-collapse text-left text-xs">
							<thead className="bg-muted/60 text-[10px] text-muted-foreground uppercase tracking-wider">
								<tr>
									<Th>Ticket</Th>
									<Th>Status</Th>
									<Th>Reporter</Th>
									<Th>Route</Th>
									<Th>Updated</Th>
									<Th>
										<span className="sr-only">Open</span>
									</Th>
								</tr>
							</thead>
							<tbody>
								{tickets.map((ticket) => (
									<tr
										key={ticket.id}
										className="border-t transition-colors hover:bg-muted/40"
									>
										<td className="max-w-md px-3 py-3">
											<Link
												to="/tickets/$ticketId"
												params={{ ticketId: ticket.id }}
												className="font-medium hover:underline"
											>
												{ticket.title}
											</Link>
											<div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
												{ticket.id}
											</div>
										</td>
										<td className="px-3 py-3">
											<StatusBadge status={ticket.status} />
										</td>
										<td className="px-3 py-3">{ticket.reporterName}</td>
										<td className="px-3 py-3 text-muted-foreground">
											{ticket.route ?? "Unassigned"}
										</td>
										<td
											className="px-3 py-3 text-muted-foreground"
											title={ticket.updatedAt.toLocaleString()}
										>
											{timeAgo(ticket.updatedAt)}
										</td>
										<td className="px-3 py-3 text-right">
											<Link
												to="/tickets/$ticketId"
												params={{ ticketId: ticket.id }}
												aria-label={`Open ${ticket.title}`}
											>
												<ArrowRight className="inline size-4" />
											</Link>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</main>
	);
}

function Stat({
	label,
	value,
	alert,
}: {
	label: string;
	value: number;
	alert?: boolean;
}) {
	return (
		<div className="border-r p-3 last:border-r-0">
			<p className="text-[10px] text-muted-foreground uppercase tracking-wider">
				{label}
			</p>
			<p
				className={
					alert
						? "mt-1 font-semibold text-destructive text-xl"
						: "mt-1 font-semibold text-xl"
				}
			>
				{value}
			</p>
		</div>
	);
}
function Th({ children }: { children: React.ReactNode }) {
	return <th className="px-3 py-2 font-medium">{children}</th>;
}
