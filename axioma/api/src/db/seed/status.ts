/**
 * Service status page — impact levels, tracked services, incident history.
 *
 * Backs the portal's /status route, which renders "Status is not available yet"
 * until status_services holds rows.
 */

import { db } from "@/db";
import {
	serviceImpactLevels,
	statusIncidents,
	statusServices,
} from "@/db/schema/status";
import { daysFromEpoch } from "./data";

const IMPACT_LEVELS = [
	{ key: "operational", label: "Operational", countsAsDowntime: false },
	{ key: "degraded", label: "Degraded performance", countsAsDowntime: false },
	{ key: "partial", label: "Partial outage", countsAsDowntime: true },
	{ key: "major", label: "Major outage", countsAsDowntime: true },
	{ key: "maintenance", label: "Under maintenance", countsAsDowntime: false },
] as const;

const STATUS_SERVICES = [
	{
		id: "demo-status-svc-01",
		name: "Employee portal",
		description: "Raise and track requests, browse help articles.",
	},
	{
		id: "demo-status-svc-02",
		name: "Email ingestion",
		description: "Tickets created from mail sent to support@ and helpdesk@.",
	},
	{
		id: "demo-status-svc-03",
		name: "Device agent",
		description: "Enrolled device check-in, inventory and command execution.",
	},
	{
		id: "demo-status-svc-04",
		name: "Single sign-on",
		description: "SSO authentication for portal and console.",
	},
	{
		id: "demo-status-svc-05",
		name: "Reporting & dashboards",
		description: "Ticket statistics, SLA compliance and overview widgets.",
	},
] as const;

/**
 * A believable recent history: mostly resolved, one still open so the page has
 * a live incident, and one planned maintenance window.
 */
const INCIDENTS = [
	{
		id: "demo-status-incident-01",
		serviceId: "demo-status-svc-02",
		impactLevel: "partial",
		title: "Delayed ticket creation from inbound email",
		plannedMaintenance: false,
		startedDay: 3,
		resolvedDay: 3,
	},
	{
		id: "demo-status-incident-02",
		serviceId: "demo-status-svc-04",
		impactLevel: "major",
		title: "SSO login loop after password reset",
		plannedMaintenance: false,
		startedDay: 7,
		resolvedDay: 8,
	},
	{
		id: "demo-status-incident-03",
		serviceId: "demo-status-svc-05",
		impactLevel: "degraded",
		title: "Slow dashboard queries during peak hours",
		plannedMaintenance: false,
		startedDay: 12,
		resolvedDay: 12,
	},
	{
		id: "demo-status-incident-04",
		serviceId: "demo-status-svc-01",
		impactLevel: "maintenance",
		title: "Scheduled database upgrade",
		plannedMaintenance: true,
		startedDay: 16,
		resolvedDay: 16,
	},
	{
		id: "demo-status-incident-05",
		serviceId: "demo-status-svc-03",
		impactLevel: "partial",
		title: "Device check-in backlog after agent rollout",
		plannedMaintenance: false,
		startedDay: 21,
		resolvedDay: 22,
	},
	{
		// Left unresolved so the status page shows a currently-active incident.
		id: "demo-status-incident-06",
		serviceId: "demo-status-svc-03",
		impactLevel: "degraded",
		title: "Intermittent command timeouts on Windows agents",
		plannedMaintenance: false,
		startedDay: 26,
		resolvedDay: null,
	},
] as const;

export async function seedStatus(): Promise<void> {
	await db.transaction(async (tx) => {
		for (const level of IMPACT_LEVELS) {
			await tx
				.insert(serviceImpactLevels)
				.values({
					key: level.key,
					label: level.label,
					countsAsDowntime: level.countsAsDowntime,
				})
				.onConflictDoNothing();
		}

		for (const svc of STATUS_SERVICES) {
			await tx
				.insert(statusServices)
				.values({
					id: svc.id,
					name: svc.name,
					description: svc.description,
					active: true,
					createdAt: daysFromEpoch(1, 9),
				})
				.onConflictDoNothing();
		}

		for (const incident of INCIDENTS) {
			await tx
				.insert(statusIncidents)
				.values({
					id: incident.id,
					serviceId: incident.serviceId,
					impactLevel: incident.impactLevel,
					title: incident.title,
					plannedMaintenance: incident.plannedMaintenance,
					startedAt: daysFromEpoch(incident.startedDay, 9),
					resolvedAt:
						incident.resolvedDay === null
							? null
							: daysFromEpoch(incident.resolvedDay, 14),
					createdAt: daysFromEpoch(incident.startedDay, 9),
				})
				.onConflictDoNothing();
		}
	});

	console.log(
		"[seed:status] seeded impact levels, status services, incident history",
	);
}
