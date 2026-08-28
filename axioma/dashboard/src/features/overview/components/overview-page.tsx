import { useQuery } from "@tanstack/react-query";
import { CircleCheckBig, Clock3, ShieldAlert, TicketCheck } from "lucide-react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ticketQueries } from "@/features/tickets/api/queries";

export function OverviewPage() {
	const query = useQuery(ticketQueries.list("all"));
	if (query.isPending)
		return (
			<PageContainer title="Overview">
				<PageState
					kind="loading"
					title="Loading overview"
					description="Calculating service desk activity…"
				/>
			</PageContainer>
		);
	if (query.isError)
		return (
			<PageContainer title="Overview">
				<PageState
					kind="error"
					title="Overview unavailable"
					description={query.error.message}
					onRetry={() => query.refetch()}
				/>
			</PageContainer>
		);
	const tickets = query.data;
	const active = tickets.filter(
		(ticket) => !["closed", "resolved"].includes(ticket.status),
	).length;
	const escalated = tickets.filter(
		(ticket) => ticket.status === "escalated",
	).length;
	const resolved = tickets.filter((ticket) =>
		["closed", "resolved"].includes(ticket.status),
	).length;
	const days = Array.from({ length: 7 }, (_, index) => {
		const date = new Date();
		date.setHours(0, 0, 0, 0);
		date.setDate(date.getDate() - 6 + index);
		return {
			day: date.toLocaleDateString(undefined, { weekday: "short" }),
			tickets: tickets.filter(
				(ticket) =>
					ticket.createdAt >= date &&
					ticket.createdAt < new Date(date.getTime() + 86_400_000),
			).length,
		};
	});
	const outcomes = [
		"open",
		"routing",
		"resolving",
		"resolved",
		"escalated",
		"closed",
	].map((status) => ({
		status,
		tickets: tickets.filter((ticket) => ticket.status === status).length,
	}));
	return (
		<PageContainer
			title="Overview"
			description="Axel activity and service desk outcomes at a glance."
		>
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<Stat label="Total tickets" value={tickets.length} icon={TicketCheck} />
				<Stat label="Active" value={active} icon={Clock3} />
				<Stat
					label="Escalated"
					value={escalated}
					icon={ShieldAlert}
					alert={escalated > 0}
				/>
				<Stat label="Resolved" value={resolved} icon={CircleCheckBig} />
			</div>
			<div className="mt-4 grid gap-4 lg:grid-cols-7">
				<ChartCard
					className="lg:col-span-4"
					title="Ticket volume"
					description="New requests over the last seven days"
				>
					<ResponsiveContainer width="100%" height={280}>
						<BarChart data={days}>
							<CartesianGrid vertical={false} stroke="var(--border)" />
							<XAxis dataKey="day" tickLine={false} axisLine={false} />
							<YAxis
								allowDecimals={false}
								tickLine={false}
								axisLine={false}
								width={28}
							/>
							<Tooltip />
							<Bar
								dataKey="tickets"
								fill="var(--chart-2)"
								radius={[4, 4, 0, 0]}
							/>
						</BarChart>
					</ResponsiveContainer>
				</ChartCard>
				<ChartCard
					className="lg:col-span-3"
					title="Resolution outcomes"
					description="Current queue by status"
				>
					<ResponsiveContainer width="100%" height={280}>
						<BarChart data={outcomes} layout="vertical">
							<CartesianGrid horizontal={false} stroke="var(--border)" />
							<XAxis type="number" allowDecimals={false} hide />
							<YAxis
								dataKey="status"
								type="category"
								tickLine={false}
								axisLine={false}
								width={72}
							/>
							<Tooltip />
							<Bar
								dataKey="tickets"
								fill="var(--chart-4)"
								radius={[0, 4, 4, 0]}
							/>
						</BarChart>
					</ResponsiveContainer>
				</ChartCard>
			</div>
		</PageContainer>
	);
}

function Stat({
	label,
	value,
	icon: Icon,
	alert = false,
}: {
	label: string;
	value: number;
	icon: typeof TicketCheck;
	alert?: boolean;
}) {
	return (
		<Card className="rounded-xl bg-gradient-to-t from-primary/5 to-card shadow-xs">
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<CardTitle
					className={`text-3xl tabular-nums ${alert ? "text-destructive" : ""}`}
				>
					{value}
				</CardTitle>
				<CardAction>
					<span className="grid size-8 place-items-center rounded-md border bg-background">
						<Icon className="size-4" />
					</span>
				</CardAction>
			</CardHeader>
		</Card>
	);
}
function ChartCard({
	title,
	description,
	children,
	className,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<Card className={`rounded-xl shadow-xs ${className ?? ""}`}>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}
