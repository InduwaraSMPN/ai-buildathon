/**
 * Scheduling seed — recurring tickets + occurrences, ticketScheduling rows.
 * Depends on tickets.
 */

import { db } from "@/db";
import {
	recurringTicketOccurrences,
	recurringTickets,
	ticketScheduling,
} from "@/db/schema/scheduling";
import { daysFromEpoch } from "./data";

export async function seedScheduling(ticketIds: string[]): Promise<void> {
	if (!ticketIds.length) {
		console.warn("[seed:scheduling] no tickets, skipping");
		return;
	}

	await db.transaction(async (tx) => {
		// Recurring tickets — 4
		const recurringDefs = [
			{
				id: "demo-recurring-01",
				sourceTicketId: ticketIds[0]!,
				frequency: "weekly" as const,
				interval: 1,
				startsAt: daysFromEpoch(7, 9),
				until: daysFromEpoch(90, 9),
			},
			{
				id: "demo-recurring-02",
				sourceTicketId: ticketIds[1]!,
				frequency: "monthly" as const,
				interval: 1,
				startsAt: daysFromEpoch(14, 9),
				until: daysFromEpoch(120, 9),
			},
			{
				id: "demo-recurring-03",
				sourceTicketId: ticketIds[2]!,
				frequency: "daily" as const,
				interval: 2,
				startsAt: daysFromEpoch(3, 9),
				until: null,
			},
			{
				id: "demo-recurring-04",
				sourceTicketId: ticketIds[3]!,
				frequency: "weekly" as const,
				interval: 2,
				startsAt: daysFromEpoch(10, 9),
				until: daysFromEpoch(80, 9),
			},
		];

		for (const r of recurringDefs) {
			await tx
				.insert(recurringTickets)
				.values({
					id: r.id,
					sourceTicketId: r.sourceTicketId,
					frequency: r.frequency,
					interval: r.interval,
					startsAt: r.startsAt,
					until: r.until,
					enabled: r.id !== "demo-recurring-04", // one disabled
					createdAt: daysFromEpoch(5, 9),
					updatedAt: daysFromEpoch(5, 9),
				})
				.onConflictDoNothing();
		}

		// Occurrences — 2 per recurring
		for (let i = 0; i < recurringDefs.length; i++) {
			const r = recurringDefs[i]!;
			for (let j = 0; j < 2; j++) {
				const id = `demo-occurrence-${r.id}-${String(j + 1).padStart(2, "0")}`;
				const occursAt = daysFromEpoch(7 + i * 7 + j * 7, 9);
				const idempotencyKey = `demo-occ-key-${r.id}-${String(j).padStart(2, "0")}`;
				const generatedTicketId =
					j === 0 && i < 2 ? ticketIds[(i + 10) % ticketIds.length]! : null;
				await tx
					.insert(recurringTicketOccurrences)
					.values({
						id,
						recurringTicketId: r.id,
						occursAt,
						idempotencyKey,
						generatedTicketId,
						createdAt: daysFromEpoch(6, 9),
					})
					.onConflictDoNothing();
			}
		}

		// Ticket scheduling rows — ~10 tickets get scheduling data
		for (let i = 0; i < Math.min(10, ticketIds.length); i++) {
			const ticketId = ticketIds[i]!;
			const workStartAt = daysFromEpoch(20 + i, 9);
			const workEndAt = daysFromEpoch(20 + i, 17);
			const snoozedUntil = i % 3 === 0 ? daysFromEpoch(25 + i, 9) : null;
			await tx
				.insert(ticketScheduling)
				.values({
					ticketId,
					workStartAt,
					workEndAt,
					workAllDay: i % 5 === 4,
					snoozedUntil,
					updatedAt: daysFromEpoch(20 + i, 9),
				})
				.onConflictDoNothing();
		}
	});

	console.log(
		"[seed:scheduling] seeded recurring tickets, occurrences, scheduling",
	);
}
