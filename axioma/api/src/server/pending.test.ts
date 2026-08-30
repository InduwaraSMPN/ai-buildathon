import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
	pendingFollowups,
	pendingReasons,
	ticketMessages,
	tickets,
	user,
} from "@/db/schema";
import { nextPendingFollowupAt, sweepPending } from "./pending";

test("pending follow-ups are scheduled from the latest successful sweep", () => {
	assert.equal(
		nextPendingFollowupAt(new Date("2026-01-01T10:00:00Z"), 90).toISOString(),
		"2026-01-01T11:30:00.000Z",
	);
});

test("pending sweep applies its bounded follow-up transaction", async () => {
	const suffix = crypto.randomUUID();
	const reporterId = `pending-user-${suffix}`;
	const reasonId = `pending-reason-${suffix}`;
	const ticketId = `pending-ticket-${suffix}`;
	await db.insert(user).values({
		id: reporterId,
		name: "Pending test",
		email: `${reporterId}@example.test`,
	});
	await db.insert(pendingReasons).values({
		id: reasonId,
		name: "Awaiting reply",
		followupFrequencyMinutes: 60,
		followupsBeforeResolution: 2,
	});
	await db.insert(tickets).values({
		id: ticketId,
		reporterId,
		number: `T-${suffix}`,
		title: "Pending ticket",
		body: "Waiting for more information",
		status: "pending",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
		pendingReasonId: reasonId,
		pendingUntil: new Date("2026-01-01T00:00:00Z"),
	});
	try {
		assert.equal(await sweepPending(new Date("2026-01-02T00:00:00Z"), 1), 1);
		const [ticket, followups, messages] = await Promise.all([
			db.select().from(tickets).where(eq(tickets.id, ticketId)),
			db
				.select()
				.from(pendingFollowups)
				.where(eq(pendingFollowups.ticketId, ticketId)),
			db
				.select()
				.from(ticketMessages)
				.where(eq(ticketMessages.ticketId, ticketId)),
		]);
		assert.equal(ticket[0]?.pendingFollowups, 1);
		assert.equal(followups.length, 1);
		assert.equal(messages.length, 1);
	} finally {
		await db.delete(tickets).where(eq(tickets.id, ticketId));
		await db.delete(pendingReasons).where(eq(pendingReasons.id, reasonId));
		await db.delete(user).where(eq(user.id, reporterId));
	}
});
