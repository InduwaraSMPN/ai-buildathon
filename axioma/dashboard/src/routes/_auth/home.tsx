import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	CircleCheckBig,
	Clock3,
	Search,
	ShieldAlert,
	TicketCheck,
	TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageState, StatusBadge, timeAgo } from "@/components/support-ui";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
	const all = query.data ?? [];
	const tickets = useMemo(() => {
		const needle = search.trim().toLowerCase();
		return all.filter(
			(ticket) =>
				(status === "all" || ticket.status === status) &&
				(!needle ||
					`${ticket.id} ${ticket.title} ${ticket.reporterName} ${ticket.route ?? ""}`
						.toLowerCase()
						.includes(needle)),
		);
	}, [all, search, status]);
	const active = all.filter(
		(ticket) => !["closed", "resolved"].includes(ticket.status),
	).length;
	const escalated = all.filter(
		(ticket) => ticket.status === "escalated",
	).length;
	const resolved = all.filter((ticket) =>
		["closed", "resolved"].includes(ticket.status),
	).length;

	return (
		<div className="@container/main flex flex-col gap-6 px-4 py-6 lg:px-6">
			<div>
				<h1 className="font-bold text-2xl tracking-tight">Dashboard</h1>
				<p className="text-muted-foreground text-sm">
					Live service desk activity and Axel’s current workload.
				</p>
			</div>

			<section
				className="grid gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-4"
				aria-label="Queue overview"
			>
				<MetricCard
					label="Total tickets"
					value={all.length}
					icon={TicketCheck}
					detail="Across the service desk"
				/>
				<MetricCard
					label="Active now"
					value={active}
					icon={Clock3}
					detail="Awaiting or under investigation"
				/>
				<MetricCard
					label="Escalated"
					value={escalated}
					icon={ShieldAlert}
					detail="Needs human attention"
					alert={escalated > 0}
				/>
				<MetricCard
					label="Resolved"
					value={resolved}
					icon={CircleCheckBig}
					detail="Completed successfully"
				/>
			</section>

			<WorkloadChart tickets={all} />

			<section
				className="overflow-hidden rounded-xl border bg-card shadow-xs"
				aria-labelledby="queue-heading"
			>
				<div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 id="queue-heading" className="font-semibold">
							Ticket queue
						</h2>
						<p className="text-muted-foreground text-xs">
							Triage, route, and resolve employee requests.
						</p>
					</div>
					<label
						htmlFor="ticket-search"
						className="relative block w-full sm:w-72"
					>
						<span className="sr-only">Search tickets</span>
						<Search className="absolute top-2 left-2.5 size-3.5 text-muted-foreground" />
						<Input
							id="ticket-search"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search tickets…"
							className="pl-8"
						/>
					</label>
				</div>
				<fieldset className="flex gap-1 overflow-x-auto border-b p-3">
					<legend className="sr-only">Filter by status</legend>
					{statuses.map((item) => (
						<button
							key={item}
							type="button"
							onClick={() => setStatus(item)}
							aria-pressed={status === item}
							className="shrink-0 rounded-md px-3 py-1.5 font-medium text-muted-foreground text-xs capitalize transition-colors hover:bg-muted hover:text-foreground aria-pressed:bg-secondary aria-pressed:text-foreground"
						>
							{item}
						</button>
					))}
				</fieldset>
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
					<div className="overflow-x-auto">
						<table className="w-full min-w-[900px] border-collapse text-left text-xs">
							<thead className="bg-muted/40 text-muted-foreground">
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
										<td className="max-w-md px-4 py-3">
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
										<td className="px-4 py-3">
											<StatusBadge status={ticket.status} />
										</td>
										<td className="px-4 py-3">{ticket.reporterName}</td>
										<td className="px-4 py-3 text-muted-foreground">
											{ticket.route ?? "Unassigned"}
										</td>
										<td
											className="px-4 py-3 text-muted-foreground"
											title={ticket.updatedAt.toLocaleString()}
										>
											{timeAgo(ticket.updatedAt)}
										</td>
										<td className="px-4 py-3 text-right">
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
				<div className="flex items-center justify-between border-t px-4 py-3 text-muted-foreground text-xs">
					<span>
						{tickets.length} of {all.length} ticket{all.length === 1 ? "" : "s"}
					</span>
					<span>Live data</span>
				</div>
			</section>
		</div>
	);
}

function MetricCard({
	label,
	value,
	icon: Icon,
	detail,
	alert = false,
}: {
	label: string;
	value: number;
	icon: typeof TicketCheck;
	detail: string;
	alert?: boolean;
}) {
	return (
		<Card className="@container/card rounded-xl">
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<CardTitle
					className={`font-semibold @[250px]/card:text-3xl text-2xl tabular-nums ${alert ? "text-destructive" : ""}`}
				>
					{value}
				</CardTitle>
				<CardAction>
					<span className="grid size-8 place-items-center rounded-lg border bg-background">
						<Icon className="size-4" />
					</span>
				</CardAction>
			</CardHeader>
			<CardFooter className="flex-col items-start gap-1 border-0 pt-0">
				<div className="flex items-center gap-1.5 font-medium text-xs">
					{detail} <TrendingUp className="size-3.5" />
				</div>
				<div className="text-muted-foreground text-xs">
					Updated from the current queue
				</div>
			</CardFooter>
		</Card>
	);
}

type Ticket = { status: string; createdAt: Date };
function WorkloadChart({ tickets }: { tickets: Ticket[] }) {
	const days = Array.from({ length: 7 }, (_, index) => {
		const date = new Date();
		date.setHours(0, 0, 0, 0);
		date.setDate(date.getDate() - (6 - index));
		const count = tickets.filter((ticket) => {
			const created = new Date(ticket.createdAt);
			return created >= date && created < new Date(date.getTime() + 86_400_000);
		}).length;
		return {
			label: date.toLocaleDateString(undefined, { weekday: "short" }),
			count,
		};
	});
	const max = Math.max(1, ...days.map((day) => day.count));
	const points = days
		.map((day, index) => `${(index / 6) * 100},${92 - (day.count / max) * 72}`)
		.join(" ");
	return (
		<Card className="rounded-xl shadow-xs">
			<CardHeader>
				<CardTitle>Ticket activity</CardTitle>
				<CardDescription>
					New requests received over the last seven days
				</CardDescription>
				<CardAction>
					<span className="rounded-md border px-2 py-1 text-muted-foreground text-xs">
						Last 7 days
					</span>
				</CardAction>
			</CardHeader>
			<CardContent>
				<div
					className="h-52 w-full"
					role="img"
					aria-label={`Ticket activity: ${days.map((day) => `${day.label} ${day.count}`).join(", ")}`}
				>
					<svg
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						className="h-44 w-full overflow-visible"
					>
						<title>Ticket activity over the last seven days</title>
						<defs>
							<linearGradient id="ticket-area" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="0%"
									stopColor="var(--color-primary)"
									stopOpacity="0.35"
								/>
								<stop
									offset="100%"
									stopColor="var(--color-primary)"
									stopOpacity="0.02"
								/>
							</linearGradient>
						</defs>
						<path
							d={`M 0,92 L ${points} L 100,100 L 0,100 Z`}
							fill="url(#ticket-area)"
						/>
						<polyline
							points={points}
							fill="none"
							stroke="var(--color-primary)"
							strokeWidth="1.2"
							vectorEffect="non-scaling-stroke"
						/>
					</svg>
					<div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground">
						{days.map((day) => (
							<span key={day.label}>{day.label}</span>
						))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function Th({ children }: { children: React.ReactNode }) {
	return <th className="px-4 py-2.5 font-medium">{children}</th>;
}
