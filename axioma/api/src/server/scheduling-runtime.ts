import { and, eq, gte, lte, max } from "drizzle-orm";
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

export async function generateDueRecurrences(now = new Date(), limit = 100) {
	const rules = await db
		.select()
		.from(recurringTickets)
		.where(
			and(
				eq(recurringTickets.enabled, true),
				lte(recurringTickets.startsAt, now),
			),
		);
	let created = 0;
	let skipped = 0;
	let truncated = false;
	for (const rule of rules) {
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
			limit + 1,
			startOrdinal,
		);
		if (occurrences.length > limit) truncated = true;
		for (const occurrence of occurrences.slice(0, limit)) {
			const generated = await db.transaction(async (tx) => {
				const [claimed] = await tx
					.insert(recurringTicketOccurrences)
					.values({ id: crypto.randomUUID(), ...occurrence })
					.onConflictDoNothing()
					.returning({ id: recurringTicketOccurrences.id });
				if (!claimed) return false;
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
			if (generated !== false) {
				void finalizeCreatedTicket(generated.generated, {
					reporterId: generated.reporterId,
				});
				created++;
			} else skipped++;
		}
	}
	return { created, skipped, truncated };
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
