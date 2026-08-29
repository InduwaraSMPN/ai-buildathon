import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { type createDb, db } from "@/db";
import { ticketNumberCounters } from "@/db/schema/numbering";
import { problems, problemTickets } from "@/db/schema/problems";
import { tickets } from "@/db/schema/tickets";

export type ProblemsDb = ReturnType<typeof createDb>;
type Problem = typeof problems.$inferSelect;
type NewProblem = Pick<
	typeof problems.$inferInsert,
	"title" | "description" | "priority" | "assigneeId" | "serviceId"
>;
type ProblemChanges = Partial<
	Pick<
		typeof problems.$inferInsert,
		| "title"
		| "description"
		| "status"
		| "priority"
		| "assigneeId"
		| "rootCause"
		| "workaround"
		| "isKnownError"
		| "serviceId"
	>
>;

export type ProblemDetail = Problem & {
	ticketIds: string[];
	resolutionOffer: string | null;
};

export type IncidentResolutionOffer = {
	ticketId: string;
	currentResolution: string | null;
	resolutionOffer: string;
};

export function offerIncidentResolutions(
	incidents: readonly Pick<
		IncidentResolutionOffer,
		"ticketId" | "currentResolution"
	>[],
	resolution: string,
): IncidentResolutionOffer[] {
	return incidents.map((incident) => ({
		...incident,
		resolutionOffer: resolution,
	}));
}

export function formatProblemNumber(year: number, sequence: number): string {
	if (
		!Number.isSafeInteger(year) ||
		year < 0 ||
		!Number.isSafeInteger(sequence) ||
		sequence < 1
	)
		throw new RangeError("year and sequence must be positive integers");
	return `PRB-${year}-${String(sequence).padStart(5, "0")}`;
}

/** `isKnownError` is the schema's publication flag for a usable workaround. */
export function publishedWorkaround(
	problem: Pick<Problem, "isKnownError" | "workaround">,
) {
	return problem.isKnownError && problem.workaround?.trim()
		? problem.workaround
		: null;
}

export async function listProblems(database: ProblemsDb = defaultDb()) {
	return database.select().from(problems).orderBy(desc(problems.createdAt));
}

export async function getProblem(
	id: string,
	database: ProblemsDb = defaultDb(),
): Promise<ProblemDetail | null> {
	const problem = (
		await database.select().from(problems).where(eq(problems.id, id)).limit(1)
	)[0];
	if (!problem) return null;
	const links = await database
		.select({ ticketId: problemTickets.ticketId })
		.from(problemTickets)
		.where(eq(problemTickets.problemId, id))
		.orderBy(problemTickets.createdAt);
	return {
		...problem,
		ticketIds: links.map(({ ticketId }) => ticketId),
		resolutionOffer:
			problem.status === "closed"
				? (problem.rootCause ?? problem.workaround)
				: null,
	};
}

export async function createProblem(
	input: NewProblem & { ticketIds?: readonly string[] },
	database: ProblemsDb = defaultDb(),
): Promise<ProblemDetail> {
	const id = randomUUID();
	const year = new Date().getUTCFullYear();
	await database.transaction(async (tx) => {
		const ticketIds = uniqueIds(input.ticketIds ?? []);
		await assertIncidentTickets(tx, ticketIds);
		const counter = (
			await tx
				.insert(ticketNumberCounters)
				.values({ prefix: "PRB", year: String(year), lastValue: 1 })
				.onConflictDoUpdate({
					target: [ticketNumberCounters.prefix, ticketNumberCounters.year],
					set: { lastValue: sql`${ticketNumberCounters.lastValue} + 1` },
				})
				.returning({ value: ticketNumberCounters.lastValue })
		)[0];
		if (!counter) throw new ORPCError("INTERNAL_SERVER_ERROR");
		await tx.insert(problems).values({
			id,
			problemNumber: formatProblemNumber(year, counter.value),
			title: input.title,
			description: input.description,
			priority: input.priority,
			assigneeId: input.assigneeId,
			serviceId: input.serviceId,
		});
		if (ticketIds.length)
			await tx
				.insert(problemTickets)
				.values(ticketIds.map((ticketId) => ({ problemId: id, ticketId })));
	});
	return requireProblem(id, database);
}

export async function updateProblem(
	id: string,
	changes: ProblemChanges,
	database: ProblemsDb = defaultDb(),
): Promise<ProblemDetail> {
	const updated = await database
		.update(problems)
		.set({ ...changes, updatedAt: new Date() })
		.where(eq(problems.id, id))
		.returning({ id: problems.id });
	if (!updated[0]) throw new ORPCError("NOT_FOUND");
	return requireProblem(id, database);
}

export async function linkProblemIncidents(
	problemId: string,
	ticketIds: readonly string[],
	database: ProblemsDb = defaultDb(),
): Promise<ProblemDetail> {
	const ids = uniqueIds(ticketIds);
	if (!ids.length)
		throw new ORPCError("BAD_REQUEST", {
			message: "At least one incident is required",
		});
	await database.transaction(async (tx) => {
		if (
			!(
				await tx
					.select({ id: problems.id })
					.from(problems)
					.where(eq(problems.id, problemId))
					.limit(1)
			)[0]
		)
			throw new ORPCError("NOT_FOUND", { message: "Problem not found" });
		await assertIncidentTickets(tx, ids);
		await tx
			.insert(problemTickets)
			.values(ids.map((ticketId) => ({ problemId, ticketId })))
			.onConflictDoNothing();
	});
	return requireProblem(problemId, database);
}

export const linkProblemTickets = linkProblemIncidents;

/** Returns published problem workarounds visible from an incident. */
export async function listLinkedPublishedWorkarounds(
	ticketId: string,
	database: ProblemsDb = defaultDb(),
) {
	return database
		.select({
			problemId: problems.id,
			problemNumber: problems.problemNumber,
			title: problems.title,
			workaround: problems.workaround,
		})
		.from(problemTickets)
		.innerJoin(problems, eq(problemTickets.problemId, problems.id))
		.where(
			and(
				eq(problemTickets.ticketId, ticketId),
				eq(problems.isKnownError, true),
				isNotNull(problems.workaround),
				sql`length(trim(${problems.workaround})) > 0`,
			),
		)
		.orderBy(desc(problems.updatedAt));
}

/**
 * Closes the problem and returns resolution offers. Existing incident resolutions
 * are deliberately returned, never overwritten; accepting an offer is a separate action.
 */
export async function closeProblem(
	id: string,
	resolution: string,
	database: ProblemsDb = defaultDb(),
): Promise<{
	problem: ProblemDetail;
	incidentOffers: IncidentResolutionOffer[];
}> {
	const offer = resolution.trim();
	if (!offer)
		throw new ORPCError("BAD_REQUEST", { message: "A resolution is required" });
	const incidentOffers = await database.transaction(async (tx) => {
		const changed = await tx
			.update(problems)
			.set({ status: "closed", rootCause: offer, updatedAt: new Date() })
			.where(eq(problems.id, id))
			.returning({ id: problems.id });
		if (!changed[0]) throw new ORPCError("NOT_FOUND");
		const incidents = await tx
			.select({ ticketId: tickets.id, currentResolution: tickets.resolution })
			.from(problemTickets)
			.innerJoin(tickets, eq(problemTickets.ticketId, tickets.id))
			.where(eq(problemTickets.problemId, id));
		return offerIncidentResolutions(incidents, offer);
	});
	return { problem: await requireProblem(id, database), incidentOffers };
}

type QueryDb = Pick<ProblemsDb, "select">;

async function assertIncidentTickets(
	database: QueryDb,
	ticketIds: readonly string[],
) {
	if (!ticketIds.length) return;
	const found = await database
		.select({ id: tickets.id, recordType: tickets.recordType })
		.from(tickets)
		.where(inArray(tickets.id, [...ticketIds]));
	if (found.length !== ticketIds.length)
		throw new ORPCError("NOT_FOUND", {
			message: "One or more tickets do not exist",
		});
	const nonIncident = found.find(({ recordType }) => recordType !== "incident");
	if (nonIncident)
		throw new ORPCError("BAD_REQUEST", {
			message: `Ticket ${nonIncident.id} is not an incident`,
		});
}

function uniqueIds(ids: readonly string[]) {
	return [...new Set(ids)];
}

async function requireProblem(id: string, database: ProblemsDb) {
	const problem = await getProblem(id, database);
	if (!problem) throw new ORPCError("NOT_FOUND");
	return problem;
}

function defaultDb(): ProblemsDb {
	return db;
}
