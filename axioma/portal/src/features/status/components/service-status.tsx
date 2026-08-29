import type { ServiceStatus } from "@/sdk/contracts/status";
import { statusCopy } from "../copy";

const tone = (availability: number) =>
	availability === 1
		? "bg-emerald-500"
		: availability >= 0.99
			? "bg-amber-500"
			: "bg-red-500";

export function ServiceStatusCard({ service }: { service: ServiceStatus }) {
	return (
		<section
			className="space-y-4 rounded-xl border bg-card p-5"
			aria-labelledby={`service-${service.id}`}
		>
			<div className="flex items-center justify-between gap-4">
				<h2 id={`service-${service.id}`} className="font-medium text-base">
					{service.name}
				</h2>
				<span className="text-muted-foreground text-xs">
					{service.days.at(-1)?.availability === 1
						? statusCopy.operational
						: statusCopy.disrupted}
				</span>
			</div>
			<div
				className="flex gap-0.5"
				role="img"
				aria-label={statusCopy.stripLabel(service.name)}
			>
				{service.days.slice(-90).map((day) => (
					<span
						key={day.date}
						className={`h-8 min-w-0 flex-1 rounded-sm ${tone(day.availability)}`}
						title={statusCopy.availabilityLabel(day.date, day.availability)}
					/>
				))}
			</div>
			<dl className="grid grid-cols-3 gap-3 text-center">
				{([7, 30, 90] as const).map((days) => (
					<div key={days}>
						<dt className="text-muted-foreground text-xs">
							{statusCopy.period(days)}
						</dt>
						<dd className="font-medium">
							{(service.uptime[days] * 100).toFixed(2)}% {statusCopy.uptime}
						</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

export function ServiceStatusList({
	services,
}: {
	services: readonly ServiceStatus[];
}) {
	return (
		<section className="space-y-5">
			<header>
				<h1 className="font-semibold text-2xl">{statusCopy.title}</h1>
				<p className="text-muted-foreground">{statusCopy.summary}</p>
			</header>
			{services.length ? (
				services.map((service) => (
					<ServiceStatusCard key={service.id} service={service} />
				))
			) : (
				<div className="rounded-xl border border-dashed bg-card p-8 text-center">
					<p className="font-medium">{statusCopy.emptyTitle}</p>
					<p className="mt-1 text-muted-foreground text-sm">
						{statusCopy.emptyDescription}
					</p>
				</div>
			)}
		</section>
	);
}
