import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
	olas,
	slas,
	ticketStatuses,
	ticketStopwatches,
	tickets,
} from "@/db/schema";
import { addWorkingMs, elapsedWorkingMs, subtractWorkingMs } from "./calendar";

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
	subtract = subtractWorkingMs,
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
	// A watch that had already spent its budget when this segment began passed its
	// deadline before `startedAt`, so the due time is walked backwards from there
	// rather than clamped to zero remaining, which would report `startedAt` itself.
	const remainingFromStart = targetMs - watch.accumulatedMs;
	const dueAt = !watch.running
		? null
		: remainingFromStart >= 0
			? await add(watch.startedAt, remainingFromStart, policy.calendarId)
			: await subtract(watch.startedAt, -remainingFromStart, policy.calendarId);
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
		dueAt,
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

/**
 * Counted in the database: the settled cohort is every stopped stopwatch ever
 * taken, so pulling the rows into Node cost one full scan per dashboard load.
 */
export async function slaAttainment(since?: Date) {
	const targetMs = sql`(case when ${ticketStopwatches.targetType} = 'response'
		then coalesce(${slas.ttoWorkingMinutes}, ${olas.ttoWorkingMinutes})
		else coalesce(${slas.ttrWorkingMinutes}, ${olas.ttrWorkingMinutes})
	end) * 60000`;
	const rows = await db
		.select({
			policyType: ticketStopwatches.policyType,
			targetType: ticketStopwatches.targetType,
			met: sql<number>`count(*) filter (where ${ticketStopwatches.accumulatedMs} <= ${targetMs})`.mapWith(
				Number,
			),
			missed:
				sql<number>`count(*) filter (where ${ticketStopwatches.accumulatedMs} > ${targetMs})`.mapWith(
					Number,
				),
		})
		.from(ticketStopwatches)
		.innerJoin(tickets, eq(ticketStopwatches.ticketId, tickets.id))
		.innerJoin(ticketStatuses, eq(tickets.status, ticketStatuses.key))
		.leftJoin(
			slas,
			and(
				eq(ticketStopwatches.policyType, "sla"),
				eq(slas.id, ticketStopwatches.policyId),
			),
		)
		.leftJoin(
			olas,
			and(
				eq(ticketStopwatches.policyType, "ola"),
				eq(olas.id, ticketStopwatches.policyId),
			),
		)
		.where(
			and(
				eq(ticketStopwatches.running, false),
				sql`coalesce(${slas.id}, ${olas.id}) is not null`,
				sql`case when ${ticketStopwatches.targetType} = 'response'
					then ${ticketStatuses.stateType} not in ('new', 'pending')
					else ${ticketStatuses.stateType} in ('resolved', 'closed')
				end`,
				since ? gte(ticketStopwatches.startedAt, since) : undefined,
			),
		)
		.groupBy(ticketStopwatches.policyType, ticketStopwatches.targetType);
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
	for (const row of rows) {
		const value = result[row.policyType][row.targetType];
		value.met = row.met;
		value.missed = row.missed;
		value.total = row.met + row.missed;
	}
	for (const policy of Object.values(result))
		for (const target of Object.values(policy))
			target.rate = target.total ? target.met / target.total : null;
	return result;
}
