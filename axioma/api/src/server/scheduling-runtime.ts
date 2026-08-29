import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import {
	recurringTicketOccurrences,
	recurringTickets,
	tickets,
} from "@/db/schema";
import { dueRecurrenceOccurrences } from "./scheduling";

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
	for (const rule of rules) {
		const existing = await db
			.select({ key: recurringTicketOccurrences.idempotencyKey })
			.from(recurringTicketOccurrences)
			.where(eq(recurringTicketOccurrences.recurringTicketId, rule.id));
		for (const occurrence of dueRecurrenceOccurrences(
			rule,
			now,
			new Set(existing.map(({ key }) => key)),
			limit,
		)) {
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
				const generatedTicketId = crypto.randomUUID();
				await tx.insert(tickets).values({
					id: generatedTicketId,
					reporterId: source.reporterId,
					deviceId: source.deviceId,
					title: source.title,
					body: source.body,
					recordType: source.recordType,
					impact: source.impact,
					urgency: source.urgency,
					priority: source.priority,
					serviceId: source.serviceId,
					serviceSubcategoryId: source.serviceSubcategoryId,
					category: source.category,
					subcategory: source.subcategory,
					status: "open",
					route: source.route,
					assigneeId: source.assigneeId,
					ownerId: source.ownerId,
					teamId: source.teamId,
				});
				await tx
					.update(recurringTicketOccurrences)
					.set({ generatedTicketId })
					.where(eq(recurringTicketOccurrences.id, claimed.id));
				return true;
			});
			generated ? created++ : skipped++;
		}
	}
	return { created, skipped };
}

let sweep: ReturnType<typeof setInterval> | undefined;
export function startRecurrenceSweep(intervalMs = 60_000) {
	if (sweep) return;
	const run = () =>
		generateDueRecurrences().catch((error) =>
			console.error("[scheduling] recurrence sweep failed", error),
		);
	void run();
	sweep = setInterval(run, intervalMs);
	sweep.unref();
}
export function closeRecurrenceSweep() {
	if (sweep) clearInterval(sweep);
	sweep = undefined;
}
