import { and, eq, or } from "drizzle-orm";

import { db } from "@/db";
import {
	contractCoverageWindows,
	contracts,
	olas,
	services,
	slas,
	ticketStatuses,
	ticketStopwatches,
	tickets,
} from "@/db/schema";
import type { Priority } from "@/shared";
import { resolveContractSla } from "../contracts";
import { elapsedWorkingMs } from "./calendar";
import { transitionStopwatch } from "./stopwatch";

type StopwatchDatabase = Pick<typeof db, "select" | "insert">;

export async function attachTicketStopwatches(
	ticketId: string,
	priority: Priority,
	at = new Date(),
	database: StopwatchDatabase = db,
): Promise<void> {
	const service = (
		await database
			.select({ id: services.id, slaId: services.slaId, olaId: services.olaId })
			.from(tickets)
			.innerJoin(services, eq(tickets.serviceId, services.id))
			.where(eq(tickets.id, ticketId))
			.limit(1)
	)[0];
	const coverage = service
		? await database
				.select({
					contractId: contracts.id,
					serviceId: contracts.serviceId,
					slaId: contractCoverageWindows.slaId,
					active: contracts.active,
					startsOn: contracts.startsOn,
					endsOn: contracts.endsOn,
					timezone: contractCoverageWindows.timezone,
					weekday: contractCoverageWindows.weekday,
					startMinute: contractCoverageWindows.startMinute,
					endMinute: contractCoverageWindows.endMinute,
					priority: contractCoverageWindows.priority,
				})
				.from(contractCoverageWindows)
				.innerJoin(
					contracts,
					eq(contractCoverageWindows.contractId, contracts.id),
				)
				.where(eq(contracts.serviceId, service.id))
		: [];
	const contractSlaId = service
		? resolveContractSla(service.id, at, coverage)
		: null;
	for (const [policyType, table] of [
		["sla", slas],
		["ola", olas],
	] as const) {
		const servicePolicyId =
			policyType === "sla" ? (contractSlaId ?? service?.slaId) : service?.olaId;
		const servicePolicy = servicePolicyId
			? (
					await database
						.select()
						.from(table)
						.where(eq(table.id, servicePolicyId))
						.limit(1)
				)[0]
			: undefined;
		const candidates = await database
			.select()
			.from(table)
			.where(or(eq(table.priority, priority), eq(table.isDefault, true)));
		const policy =
			servicePolicy ??
			candidates.find((candidate) => candidate.priority === priority) ??
			candidates.find((candidate) => candidate.isDefault);
		if (!policy) continue;
		await database
			.insert(ticketStopwatches)
			.values(
				(["response", "resolution"] as const).map((targetType) => ({
					id: crypto.randomUUID(),
					ticketId,
					policyType,
					policyId: policy.id,
					targetType,
					startedAt: at,
				})),
			)
			.onConflictDoNothing();
	}
}

export async function transitionTicketStopwatches(
	ticketId: string,
	toStatus: string,
	at = new Date(),
): Promise<void> {
	const status = (
		await db
			.select({
				pausesSla: ticketStatuses.pausesSla,
				stateType: ticketStatuses.stateType,
			})
			.from(ticketStatuses)
			.where(eq(ticketStatuses.key, toStatus))
			.limit(1)
	)[0];
	if (!status) return;
	const watches = await db
		.select()
		.from(ticketStopwatches)
		.where(eq(ticketStopwatches.ticketId, ticketId));
	for (const watch of watches) {
		const table = watch.policyType === "sla" ? slas : olas;
		const policy = (
			await db
				.select({ calendarId: table.calendarId })
				.from(table)
				.where(eq(table.id, watch.policyId))
				.limit(1)
		)[0];
		if (!policy) continue;
		const nextRunning =
			!status.pausesSla &&
			(watch.targetType === "response"
				? status.stateType === "new"
				: !["resolved", "closed"].includes(status.stateType));
		if (watch.running === nextRunning) continue;
		const next = transitionStopwatch(
			watch,
			nextRunning,
			at,
			await elapsedWorkingMs(watch.startedAt, at, policy.calendarId),
		);
		await db
			.update(ticketStopwatches)
			.set(next)
			.where(
				and(
					eq(ticketStopwatches.id, watch.id),
					eq(ticketStopwatches.startedAt, watch.startedAt),
				),
			);
	}
}
