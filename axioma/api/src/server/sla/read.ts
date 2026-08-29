import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
	olas,
	slas,
	ticketStatuses,
	ticketStopwatches,
	tickets,
} from "@/db/schema";
import { addWorkingMs, elapsedWorkingMs } from "./calendar";

export type TicketSlaTarget = {
	policyType: "sla" | "ola";
	policyId: string;
	policyName: string;
	targetType: "response" | "resolution";
	targetMs: number;
	elapsedMs: number;
	remainingMs: number;
	pendingMs: number;
	running: boolean;
	breached: boolean;
	attained: boolean | null;
	dueAt: Date | null;
};

type Watch = typeof ticketStopwatches.$inferSelect;
type Policy = {
	id: string;
	name: string;
	calendarId: string;
	ttoWorkingMinutes: number;
	ttrWorkingMinutes: number;
};
type Status = { stateType: string; pausesSla: boolean };

export async function materializeSlaTarget(
	watch: Watch,
	policy: Policy,
	status: Status,
	now = new Date(),
	elapsed = elapsedWorkingMs,
	add = addWorkingMs,
): Promise<TicketSlaTarget> {
	const liveMs = watch.running
		? await elapsed(watch.startedAt, now, policy.calendarId)
		: 0;
	const elapsedMs = watch.accumulatedMs + liveMs;
	const targetMs =
		(watch.targetType === "response"
			? policy.ttoWorkingMinutes
			: policy.ttrWorkingMinutes) * 60_000;
	const complete =
		!status.pausesSla &&
		(watch.targetType === "response"
			? status.stateType !== "new"
			: ["resolved", "closed"].includes(status.stateType));
	return {
		policyType: watch.policyType,
		policyId: policy.id,
		policyName: policy.name,
		targetType: watch.targetType,
		targetMs,
		elapsedMs,
		remainingMs: targetMs - elapsedMs,
		pendingMs: watch.pendingMs,
		running: watch.running,
		breached: elapsedMs > targetMs,
		attained: complete ? elapsedMs <= targetMs : null,
		dueAt: watch.running
			? await add(
					watch.startedAt,
					Math.max(0, targetMs - watch.accumulatedMs),
					policy.calendarId,
				)
			: null,
	};
}

async function policiesFor(watches: Watch[]) {
	const ids = (type: "sla" | "ola") =>
		watches
			.filter((watch) => watch.policyType === type)
			.map((watch) => watch.policyId);
	const slaIds = ids("sla");
	const olaIds = ids("ola");
	const [slaPolicies, olaPolicies] = await Promise.all([
		slaIds.length ? db.select().from(slas).where(inArray(slas.id, slaIds)) : [],
		olaIds.length ? db.select().from(olas).where(inArray(olas.id, olaIds)) : [],
	]);
	return new Map([
		...slaPolicies.map((policy) => [`sla:${policy.id}`, policy] as const),
		...olaPolicies.map((policy) => [`ola:${policy.id}`, policy] as const),
	]);
}

export async function listTicketSla(
	ticketId: string,
	now = new Date(),
): Promise<TicketSlaTarget[]> {
	const [ticket] = await db
		.select({
			stateType: ticketStatuses.stateType,
			pausesSla: ticketStatuses.pausesSla,
		})
		.from(tickets)
		.innerJoin(ticketStatuses, eq(tickets.status, ticketStatuses.key))
		.where(eq(tickets.id, ticketId))
		.limit(1);
	if (!ticket) return [];
	const watches = await db
		.select()
		.from(ticketStopwatches)
		.where(eq(ticketStopwatches.ticketId, ticketId));
	const policies = await policiesFor(watches);
	return Promise.all(
		watches.flatMap((watch) => {
			const policy = policies.get(`${watch.policyType}:${watch.policyId}`);
			return policy ? [materializeSlaTarget(watch, policy, ticket, now)] : [];
		}),
	);
}

export async function slaAttainment() {
	const watches = await db
		.select({ watch: ticketStopwatches, stateType: ticketStatuses.stateType })
		.from(ticketStopwatches)
		.innerJoin(tickets, eq(ticketStopwatches.ticketId, tickets.id))
		.innerJoin(ticketStatuses, eq(tickets.status, ticketStatuses.key))
		.where(eq(ticketStopwatches.running, false));
	const policies = await policiesFor(watches.map(({ watch }) => watch));
	const result = Object.fromEntries(
		["sla", "ola"].map((policyType) => [
			policyType,
			Object.fromEntries(
				["response", "resolution"].map((targetType) => [
					targetType,
					{ met: 0, missed: 0, total: 0, rate: null as number | null },
				]),
			),
		]),
	) as Record<
		"sla" | "ola",
		Record<
			"response" | "resolution",
			{ met: number; missed: number; total: number; rate: number | null }
		>
	>;
	for (const { watch, stateType } of watches) {
		const complete =
			watch.targetType === "response"
				? stateType !== "new" && stateType !== "pending"
				: ["resolved", "closed"].includes(stateType);
		const policy = policies.get(`${watch.policyType}:${watch.policyId}`);
		if (!complete || !policy) continue;
		const targetMs =
			(watch.targetType === "response"
				? policy.ttoWorkingMinutes
				: policy.ttrWorkingMinutes) * 60_000;
		const value = result[watch.policyType][watch.targetType];
		watch.accumulatedMs <= targetMs ? value.met++ : value.missed++;
		value.total++;
	}
	for (const policy of Object.values(result))
		for (const target of Object.values(policy))
			target.rate = target.total ? target.met / target.total : null;
	return result;
}
