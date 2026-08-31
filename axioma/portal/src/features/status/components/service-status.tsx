import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import type { ServiceStatus } from "@/sdk/contracts/status";
import { statusCopy } from "../copy";

// Full availability is healthy; 99% and above is degraded; anything lower is disrupted.
const tone = (availability: number) =>
	availability === 1
		? "bg-success"
		: availability >= 0.99
			? "bg-warning"
			: "bg-destructive";

export function ServiceStatusCard({ service }: { service: ServiceStatus }) {
	const operational = service.days.at(-1)?.availability === 1;

	return (
		<Card aria-labelledby={`service-${service.id}`}>
			<CardHeader className="grid grid-cols-[1fr_auto] items-center">
				<CardTitle id={`service-${service.id}`}>{service.name}</CardTitle>
				<Badge variant={operational ? "secondary" : "destructive"}>
					{operational ? statusCopy.operational : statusCopy.disrupted}
				</Badge>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
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
				<ol
					className="sr-only"
					aria-label={statusCopy.stripLabel(service.name)}
				>
					{service.days.slice(-90).map((day) => (
						<li key={day.date}>
							{statusCopy.availabilityLabel(day.date, day.availability)}
						</li>
					))}
				</ol>
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
			</CardContent>
		</Card>
	);
}

export function ServiceStatusList({
	services,
}: {
	services: readonly ServiceStatus[];
}) {
	return (
		<section className="flex flex-col gap-5">
			{services.length ? (
				services.map((service) => (
					<ServiceStatusCard key={service.id} service={service} />
				))
			) : (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>{statusCopy.emptyTitle}</EmptyTitle>
						<EmptyDescription>{statusCopy.emptyDescription}</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
		</section>
	);
}
