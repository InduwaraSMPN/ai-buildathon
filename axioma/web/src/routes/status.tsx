import { createFileRoute } from "@tanstack/react-router";
import { PageIntro } from "../components/site";
import { pageMeta } from "../lib/seo";
import { fetchStatus, type ServiceStatus } from "../lib/status";

export const Route = createFileRoute("/status")({
	head: () =>
		pageMeta({
			title: "Service status — Axiōma",
			description:
				"Daily availability for Axiōma services over the last 90 days.",
			path: "/status",
		}),
	loader: async () => {
		try {
			return await fetchStatus();
		} catch {
			return null;
		}
	},
	component: StatusPage,
	pendingComponent: StatusPending,
	errorComponent: StatusUnavailable,
});

const STATUS_LEDE =
	"Daily availability for each Axiōma service over the last 90 days, measured from recorded incidents.";

function tone(availability: number) {
	if (availability === 1) return "is-up";
	return availability >= 0.99 ? "is-degraded" : "is-down";
}

function percent(value: number) {
	return `${(value * 100).toFixed(2)}%`;
}

function dayLabel(day: { date: string; availability: number }) {
	return `${day.date}: ${percent(day.availability)} available`;
}

function ServiceCard({ service }: { service: ServiceStatus }) {
	const days = service.days.slice(-90);
	const operational = days.at(-1)?.availability === 1;

	return (
		<article className="status-card" aria-labelledby={`service-${service.id}`}>
			<header>
				<h2 id={`service-${service.id}`}>{service.name}</h2>
				<span className={`status-pill ${operational ? "is-up" : "is-down"}`}>
					{operational ? "Available" : "Disrupted"}
				</span>
			</header>

			<div className="status-track">
				<div className="status-strip" aria-hidden="true">
					{days.map((day) => (
						<span
							key={day.date}
							className={`status-day ${tone(day.availability)}`}
							title={dayLabel(day)}
						/>
					))}
				</div>
				<p className="status-scale" aria-hidden="true">
					<span>{days.length} days ago</span>
					<span>Today</span>
				</p>
			</div>
			<ol
				className="sr-only"
				aria-label={`Daily availability for ${service.name}`}
			>
				{days.map((day) => (
					<li key={day.date}>{dayLabel(day)}</li>
				))}
			</ol>

			<dl className="status-uptime">
				{([7, 30, 90] as const).map((window) => (
					<div key={window}>
						<dt>Last {window} days</dt>
						<dd>{percent(service.uptime[window])} uptime</dd>
					</div>
				))}
			</dl>
		</article>
	);
}

function StatusUnavailable() {
	return (
		<PageIntro title="Service status">
			<p>
				We could not load availability data just now. This page reports on our
				services, so a failure here does not necessarily mean a service is down.
			</p>
		</PageIntro>
	);
}

/** Shown while the loader waits on the API, in the shape of the card to come. */
function StatusPending() {
	return (
		<>
			<PageIntro title="Service status" lede={STATUS_LEDE} />
			<section className="status-list shell" aria-busy="true">
				<article className="status-card status-empty">
					<h2>Checking services</h2>
					<p>The last 90 days of availability are loading.</p>
				</article>
			</section>
		</>
	);
}

function StatusPage() {
	const services = Route.useLoaderData();

	if (services === null) {
		return <StatusUnavailable />;
	}

	return (
		<>
			<PageIntro title="Service status" lede={STATUS_LEDE} />

			<section className="status-list shell">
				{services.length ? (
					services.map((service) => (
						<ServiceCard key={service.id} service={service} />
					))
				) : (
					<article className="status-card status-empty">
						<h2>No services are being reported yet</h2>
						<p>Availability will appear here once services are monitored.</p>
					</article>
				)}
			</section>
		</>
	);
}
