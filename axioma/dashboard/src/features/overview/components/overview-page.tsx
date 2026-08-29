import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	CircleCheckBig,
	Clock3,
	ShieldAlert,
	Sparkles,
	TriangleAlert,
} from "lucide-react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
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
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { orpc } from "@/utils/orpc";
import { overviewQueries } from "../api/queries";

const DAYS = 30;
const volumeConfig = {
	incidents: { label: "Incidents", color: "var(--chart-2)" },
	serviceRequests: { label: "Service requests", color: "var(--chart-4)" },
} satisfies ChartConfig;
const outcomeConfig = {
	resolved: { label: "Resolved", color: "var(--chart-2)" },
	escalated: { label: "Escalated", color: "var(--destructive)" },
} satisfies ChartConfig;

export function OverviewPage() {
	const query = useQuery(overviewQueries.stats(DAYS));
	const arrangement = useQuery(orpc.getDashboardArrangement.queryOptions());
	if (query.isPending || arrangement.isPending)
		return (
			<PageContainer title="Overview">
				<PageState
					kind="loading"
					title="Loading overview"
					description="Fetching service desk aggregates…"
				/>
			</PageContainer>
		);
	if (query.isError || arrangement.isError)
		return (
			<PageContainer title="Overview">
				<PageState
					kind="error"
					title="Overview unavailable"
					description={
						(query.error ?? arrangement.error)?.message ?? "Try again shortly."
					}
					onRetry={() => {
						void query.refetch();
						void arrangement.refetch();
					}}
				/>
			</PageContainer>
		);

	const stats = query.data;
	const empty = Object.values(stats.byStatus).every((count) => count === 0);
	if (empty)
		return (
			<PageContainer title="Overview">
				<PageState
					kind="empty"
					title="No ticket activity"
					description="Service desk metrics will appear after the first ticket is created."
				/>
			</PageContainer>
		);

	return (
		<PageContainer
			title="Overview"
			description="Service desk demand and outcomes from one aggregate view."
		>
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
				{orderedOverviewWidgets(arrangement.data).map(({ key, width }) => (
					<div key={key} className={width === 2 ? "xl:col-span-2" : undefined}>
						{key === "priority" ? (
							<PriorityStat values={stats.openByPriority} />
						) : null}
						{key === "confirmation" ? (
							<Stat
								label="Awaiting confirmation"
								value={stats.awaitingConfirmation}
								detail="Resolved tickets"
								icon={CircleCheckBig}
								search={{ status: ["resolved"] }}
							/>
						) : null}
						{key === "escalations" ? (
							<Stat
								label="Escalated 24h"
								value={stats.escalatedLast24h}
								detail="Escalated in the last 24 hours"
								icon={ShieldAlert}
								search={{ escalatedSince: stats.escalatedSince }}
								alert={stats.escalatedLast24h > 0}
							/>
						) : null}
						{key === "resolution-rate" ? (
							<Stat
								label="Autonomous resolution rate"
								value={formatPercent(stats.autonomousResolutionRate)}
								detail={`${stats.autonomousResolutionNumerator} of ${stats.autonomousResolutionDenominator} closed`}
								icon={Sparkles}
								search={{ status: ["closed"], autonomous: true }}
							/>
						) : null}
						{key === "median-ttr" ? (
							<Stat
								label="Median TTR"
								value={formatDuration(stats.medianTimeToResolutionMs)}
								detail="All resolved tickets"
								icon={Clock3}
								search={{ resolvedAt: true }}
							/>
						) : null}
					</div>
				))}
			</div>

			<div className="mt-4 grid gap-4 lg:grid-cols-2">
				<ChartCard
					title="Resolution code mix"
					description="All coded resolutions"
				>
					<ul className="grid gap-2 text-sm">
						{Object.entries(stats.byResolutionCode).map(([code, count]) => (
							<li key={code} className="flex justify-between gap-4">
								<span>{code.replaceAll("_", " ")}</span>
								<span className="font-medium tabular-nums">{count}</span>
							</li>
						))}
					</ul>
				</ChartCard>
				<ChartCard
					title="Ticket volume"
					description={`Daily intake · last ${DAYS} days`}
				>
					<ChartContainer
						config={volumeConfig}
						className="aspect-auto h-[280px] w-full"
					>
						<AreaChart
							data={stats.daily}
							accessibilityLayer
							margin={{ left: 4, right: 4 }}
						>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="date"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								minTickGap={28}
								tickFormatter={formatDate}
							/>
							<YAxis
								allowDecimals={false}
								tickLine={false}
								axisLine={false}
								width={28}
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										labelFormatter={(value) => formatDate(String(value))}
									/>
								}
							/>
							<Area
								dataKey="incidents"
								type="monotone"
								fill="var(--color-incidents)"
								fillOpacity={0.16}
								stroke="var(--color-incidents)"
								stackId="volume"
							/>
							<Area
								dataKey="serviceRequests"
								type="monotone"
								fill="var(--color-serviceRequests)"
								fillOpacity={0.16}
								stroke="var(--color-serviceRequests)"
								stackId="volume"
							/>
						</AreaChart>
					</ChartContainer>
				</ChartCard>

				<ChartCard
					title="Resolution outcomes"
					description={`Daily outcomes · last ${DAYS} days`}
				>
					<ChartContainer
						config={outcomeConfig}
						className="aspect-auto h-[280px] w-full"
					>
						<BarChart
							data={stats.daily}
							accessibilityLayer
							margin={{ left: 4, right: 4 }}
						>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="date"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								minTickGap={28}
								tickFormatter={formatDate}
							/>
							<YAxis
								allowDecimals={false}
								tickLine={false}
								axisLine={false}
								width={28}
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										labelFormatter={(value) => formatDate(String(value))}
									/>
								}
							/>
							<Bar
								dataKey="resolved"
								fill="var(--color-resolved)"
								radius={[3, 3, 0, 0]}
							/>
							<Bar
								dataKey="escalated"
								fill="var(--color-escalated)"
								radius={[3, 3, 0, 0]}
							/>
						</BarChart>
					</ChartContainer>
				</ChartCard>
			</div>
		</PageContainer>
	);
}

export function orderedOverviewWidgets(
	saved: readonly { widgetKey: string; width: 1 | 2 }[],
) {
	const defaults = [
		{ widgetKey: "priority", width: 2 as const },
		{ widgetKey: "confirmation", width: 1 as const },
		{ widgetKey: "escalations", width: 1 as const },
		{ widgetKey: "resolution-rate", width: 1 as const },
		{ widgetKey: "median-ttr", width: 1 as const },
	];
	return (saved.length ? saved : defaults).map(({ widgetKey, width }) => ({
		key: widgetKey,
		width,
	}));
}

function PriorityStat({
	values,
}: {
	values: Record<"P1" | "P2" | "P3" | "P4", number>;
}) {
	return (
		<Card className="h-full rounded-xl shadow-xs xl:col-span-2">
			<CardHeader>
				<CardDescription>Open by priority</CardDescription>
				<CardTitle className="flex flex-wrap gap-x-4 gap-y-1 text-2xl tabular-nums">
					{(["P1", "P2", "P3", "P4"] as const).map((priority) => (
						<Link
							key={priority}
							to="/tickets"
							search={{
								status: ["open", "routing", "resolving", "escalated"],
								priority: [priority],
							}}
							className={
								priority === "P1"
									? "text-destructive hover:underline"
									: "hover:underline"
							}
						>
							{priority} {values[priority]}
						</Link>
					))}
				</CardTitle>
				<CardDescription>
					Open, routing, resolving, and escalated tickets
				</CardDescription>
				<CardAction>
					<span className="grid size-8 place-items-center rounded-md border bg-background">
						<TriangleAlert className="size-4 text-destructive" />
					</span>
				</CardAction>
			</CardHeader>
		</Card>
	);
}

function Stat({
	label,
	value,
	detail,
	icon: Icon,
	search,
	alert = false,
}: {
	label: string;
	value: number | string;
	detail: string;
	icon: typeof Clock3;
	search:
		| { status: ("resolved" | "closed")[]; autonomous?: boolean }
		| { escalatedSince: Date }
		| { resolvedAt: boolean };
	alert?: boolean;
}) {
	return (
		<Link
			to="/tickets"
			search={search}
			className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2"
		>
			<Card className="h-full rounded-xl shadow-xs transition-colors hover:border-foreground/30">
				<CardHeader>
					<CardDescription>{label}</CardDescription>
					<CardTitle
						className={`text-3xl tabular-nums ${alert ? "text-destructive" : ""}`}
					>
						{value}
					</CardTitle>
					<CardDescription>{detail}</CardDescription>
					<CardAction>
						<span className="grid size-8 place-items-center rounded-md border bg-background">
							<Icon className="size-4" />
						</span>
					</CardAction>
				</CardHeader>
			</Card>
		</Link>
	);
}

function ChartCard({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<Card className="rounded-xl shadow-xs">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}

function formatDate(value: string) {
	return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});
}

function formatPercent(rate: number | null) {
	return rate === null
		? "0%"
		: rate.toLocaleString(undefined, {
				style: "percent",
				maximumFractionDigits: 1,
			});
}

function formatDuration(milliseconds: number | null) {
	if (milliseconds === null) return "No resolved tickets";
	const hours = milliseconds / 3_600_000;
	return hours < 24
		? `${hours.toFixed(hours < 10 ? 1 : 0)}h`
		: `${(hours / 24).toFixed(1)}d`;
}
