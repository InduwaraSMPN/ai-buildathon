import { and, asc, eq, gte, lte, max } from "drizzle-orm";
import { db } from "@/db";
import {
	recurringTicketOccurrences,
	recurringTickets,
	tickets,
} from "@/db/schema";
import { dueRecurrenceOccurrences, occurrenceOrdinalAfter } from "./scheduling";
import {
	createTicketInTransaction,
	finalizeCreatedTicket,
} from "./tickets/create";

/** One page of rules per sweep; a longer list waits for the next tick. */
const RULE_PAGE = 200;
/**
 * A rule whose start was backdated has a slot for every period since. Older
 * slots are claimed but never materialised, so the cursor catches up in bounded
 * pages instead of flooding the queue with tickets nobody asked for.
 */
const BACKFILL_WINDOW_MS = 7 * 86_400_000;

export async function generateDueRecurrences(now = new Date(), limit = 100) {
	const rules = await db
		.select()
		.from(recurringTickets)
		.where(
			and(
				eq(recurringTickets.enabled, true),
				lte(recurringTickets.startsAt, now),
			),
		)
		.orderBy(asc(recurringTickets.startsAt), asc(recurringTickets.id))
		.limit(RULE_PAGE);
	const backfillFloor = new Date(now.getTime() - BACKFILL_WINDOW_MS);
	let created = 0;
	let skipped = 0;
	let stale = 0;
	let failed = 0;
	let truncated = rules.length === RULE_PAGE;
	// The budget is shared across rules so one sweep cannot create `limit` tickets
	// for every rule it happens to find.
	let budget = Math.min(Math.max(limit, 1), 1_000);
	for (const rule of rules) {
		if (budget === 0) {
			truncated = true;
			break;
		}
		try {
			const [cursor] = await db
				.select({ lastOccurrence: max(recurringTicketOccurrences.occursAt) })
				.from(recurringTicketOccurrences)
				.where(eq(recurringTicketOccurrences.recurringTicketId, rule.id));
			const lastOccurrence = cursor?.lastOccurrence ?? null;
			const startOrdinal = occurrenceOrdinalAfter(rule, lastOccurrence);
			const windowStart = lastOccurrence ?? rule.startsAt;
			const existing = await db
				.select({ key: recurringTicketOccurrences.idempotencyKey })
				.from(recurringTicketOccurrences)
				.where(
					and(
						eq(recurringTicketOccurrences.recurringTicketId, rule.id),
						gte(recurringTicketOccurrences.occursAt, windowStart),
						lte(recurringTicketOccurrences.occursAt, now),
					),
				);
			const occurrences = dueRecurrenceOccurrences(
				rule,
				now,
				new Set(existing.map(({ key }) => key)),
				budget + 1,
				startOrdinal,
			);
			if (occurrences.length > budget) truncated = true;
			for (const occurrence of occurrences.slice(0, budget)) {
				const outcome = await db.transaction(async (tx) => {
					const [claimed] = await tx
						.insert(recurringTicketOccurrences)
						.values({ id: crypto.randomUUID(), ...occurrence })
						.onConflictDoNothing()
						.returning({ id: recurringTicketOccurrences.id });
					if (!claimed) return "skipped" as const;
					if (occurrence.occursAt < backfillFloor) return "stale" as const;
					const [source] = await tx
						.select()
						.from(tickets)
						.where(eq(tickets.id, rule.sourceTicketId))
						.limit(1);
					if (!source)
						throw new Error(
							`Recurring source ticket not found: ${rule.sourceTicketId}`,
						);
					const generated = await createTicketInTransaction(tx, {
						source: "recurrence",
						reporterId: source.reporterId,
						deviceId: source.deviceId,
						title: source.title,
						body: source.body,
						recordType: source.recordType,
						impact: source.impact,
						urgency: source.urgency,
						serviceId: source.serviceId,
						serviceSubcategoryId: source.serviceSubcategoryId,
					});
					const generatedTicketId = generated.ticketId;
					await tx
						.update(recurringTicketOccurrences)
						.set({ generatedTicketId })
						.where(eq(recurringTicketOccurrences.id, claimed.id));
					return { generated, reporterId: source.reporterId };
				});
				budget--;
				if (outcome === "skipped") skipped++;
				else if (outcome === "stale") stale++;
				else {
					void finalizeCreatedTicket(outcome.generated, {
						reporterId: outcome.reporterId,
					});
					created++;
				}
			}
		} catch (error) {
			failed++;
			console.error(
				`[scheduling] recurrence rule ${rule.id} could not be generated`,
				error,
			);
		}
	}
	return { created, skipped, stale, failed, truncated };
}

let recurrenceQueue = Promise.resolve();
export function queueRecurrenceTask<TResult>(task: () => Promise<TResult>) {
	const run = recurrenceQueue.then(task);
	recurrenceQueue = run.then(
		() => undefined,
		() => undefined,
	);
	return run;
}

export function runRecurrenceSweep(now = new Date(), limit = 100) {
	return queueRecurrenceTask(() => generateDueRecurrences(now, limit));
}

let sweep: ReturnType<typeof setTimeout> | undefined;
let recurrenceClosed = true;
export function startRecurrenceSweep(intervalMs = 60_000) {
	if (!recurrenceClosed) return;
	recurrenceClosed = false;
	const run = () => {
		sweep = undefined;
		void runRecurrenceSweep()
			.catch((error) =>
				console.error("[scheduling] recurrence sweep failed", error),
			)
			.finally(() => {
				if (!recurrenceClosed) {
					sweep = setTimeout(run, intervalMs);
					sweep.unref();
				}
			});
	};
	sweep = setTimeout(run, 0);
	sweep.unref();
}
export async function closeRecurrenceSweep() {
	recurrenceClosed = true;
	if (sweep) clearTimeout(sweep);
	sweep = undefined;
	await recurrenceQueue;
}
