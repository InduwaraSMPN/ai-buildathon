import {
	RiCheckboxCircleLine as CircleCheckBig,
	RiTimeLine as Clock3,
	RiShieldFlashLine as ShieldAlert,
	RiSparklingLine as Sparkles,
	RiAlarmWarningLine as TriangleAlert,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
import { EditOverviewDialog } from "@/features/overview/components/edit-overview-dialog";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

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
	const query = useQuery(
		orpc.ticketStats.queryOptions({
			input: { days: DAYS },
		}),
	);
	const arrangement = useQuery(orpc.getDashboardArrangement.queryOptions());
	const blockingError =
		(query.data == null ? query.error : null) ??
		(arrangement.data == null ? arrangement.error : null);
	if (blockingError)
		return (
			<PageContainer title="Overview">
				<PageState
					kind="error"
					title="Overview unavailable"
					description={blockingError.message}
					onRetry={() => {
						void query.refetch();
						void arrangement.refetch();
					}}
				/>
			</PageContainer>
		);
	if (query.data == null || arrangement.data == null)
		return (
			<PageContainer title="Overview">
				<PageState
					kind="loading"
					title="Loading overview"
					description="Fetching service desk aggregates…"
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
			action={<EditOverviewDialog />}
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
								search={{ resolvedAt: true }}
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
								search={{ resolvedAt: true, autonomous: true }}
							/>
						) : null}
						{key === "median-ttr" ? (
							<Stat
								label="Median TTR"
								value={
									formatDuration(stats.medianTimeToResolutionMs) ?? (
										<span className="font-normal text-muted-foreground text-sm">
											No resolved tickets
										</span>
									)
								}
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
					title="Service-level attainment"
					description="Completed targets"
				>
					<ul className="grid gap-2 text-sm">
						{(["sla", "ola"] as const).flatMap((policy) =>
							(["response", "resolution"] as const).map((target) => {
								const value = stats.attainment[policy][target];
								return (
									<li
										key={`${policy}:${target}`}
										className="flex justify-between gap-4"
									>
										<span className="uppercase">
											{policy} {target}
										</span>
										<span className="font-medium tabular-nums">
											{formatPercent(value.rate)} · {value.met}/{value.total}
										</span>
									</li>
								);
							}),
						)}
					</ul>
				</ChartCard>
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
				<ChartCard title="CSAT" description="Reporter satisfaction">
					<div className="font-semibold text-3xl">
						{stats.csat.average?.toFixed(1) ?? "—"}
					</div>
					<p className="text-muted-foreground text-sm">
						Average rating from {stats.csat.responses} responses
					</p>
				</ChartCard>
				<ChartCard
					title="Ticket volume"
					description={`Daily intake · last ${DAYS} days`}
				>
					<ChartContainer
						config={volumeConfig}
						className="aspect-auto h-72 w-full"
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
						className="aspect-auto h-72 w-full"
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
		<StatTile
			label="Open by priority"
			detail="Tickets currently being worked"
			icon={TriangleAlert}
			valueClassName="flex flex-wrap gap-x-4 gap-y-1"
			value={(["P1", "P2", "P3", "P4"] as const).map((priority) => (
				<Link
					key={priority}
					to="/tickets"
					search={{ priority: [priority] }}
					className={
						priority === "P1"
							? "text-destructive hover:underline"
							: "hover:underline"
					}
				>
					{priority} {values[priority]}
				</Link>
			))}
		/>
	);
}

/**
 * KPI tile that follows the Card contract: the metric name is the title
 * (announced as the label), the figure is a plain emphasized value, and the
 * supporting context is the description.
 */
function StatTile({
	label,
	detail,
	icon: Icon,
	value,
	valueClassName,
	className,
}: {
	label: string;
	detail: string;
	icon: typeof Clock3;
	value: React.ReactNode;
	valueClassName?: string;
	className?: string;
}) {
	return (
		<Card className={cn("h-full", className)}>
			<CardHeader>
				<CardTitle>{label}</CardTitle>
				<div
					className={cn("font-semibold text-3xl tabular-nums", valueClassName)}
				>
					{value}
				</div>
				<CardDescription>{detail}</CardDescription>
				<CardAction>
					<span className="grid size-8 place-items-center rounded-md border bg-background">
						<Icon className="size-4" />
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
	value: React.ReactNode;
	detail: string;
	icon: typeof Clock3;
	search:
		| { escalatedSince: Date }
		| { resolvedAt: boolean; autonomous?: boolean };
	alert?: boolean;
}) {
	return (
		<Link
			to="/tickets"
			search={search}
			className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2"
		>
			<StatTile
				label={label}
				detail={detail}
				icon={Icon}
				value={value}
				valueClassName={alert ? "text-destructive" : undefined}
				className="transition-colors hover:ring-foreground/30"
			/>
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
		<Card>
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
	if (milliseconds === null) return null;
	const hours = milliseconds / 3_600_000;
	return hours < 24
		? `${hours.toFixed(hours < 10 ? 1 : 0)}h`
		: `${(hours / 24).toFixed(1)}d`;
}
