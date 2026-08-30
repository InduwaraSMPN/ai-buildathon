import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
	calendarHours,
	calendars,
	slaEscalationEvents,
	slaNotificationRules,
	slas,
	ticketStopwatches,
	tickets,
	user,
} from "@/db/schema";
import { sweepSla } from "./sweep";

test("SLA sweep atomically marks one bounded escalation", async () => {
	const suffix = crypto.randomUUID();
	const calendarId = `calendar-${suffix}`;
	const policyId = `sla-${suffix}`;
	const ruleId = `sla-rule-${suffix}`;
	const reporterId = `sla-user-${suffix}`;
	const ticketId = `sla-ticket-${suffix}`;
	const stopwatchId = `stopwatch-${suffix}`;
	const now = new Date("2000-01-02T12:00:00Z");
	await db.insert(calendars).values({
		id: calendarId,
		name: "Sweep test",
		timezone: "UTC",
	});
	await db.insert(calendarHours).values({
		id: crypto.randomUUID(),
		calendarId,
		weekday: 0,
		startTime: "00:00:00",
		endTime: "23:59:00",
	});
	await db.insert(slas).values({
		id: policyId,
		name: "Sweep test",
		calendarId,
		ttoWorkingMinutes: 1,
		ttrWorkingMinutes: 1,
	});
	await db.insert(slaNotificationRules).values({
		id: ruleId,
		name: "Sweep test",
		policyType: "sla",
		policyId,
		triggerType: "breach",
		targetType: "response",
		thresholdPercent: 100,
		recipientType: "assignee",
	});
	await db.insert(user).values({
		id: reporterId,
		name: "SLA test",
		email: `${reporterId}@example.test`,
	});
	await db.insert(tickets).values({
		id: ticketId,
		reporterId,
		number: `SLA-${suffix}`,
		title: "SLA sweep ticket",
		body: "SLA sweep test ticket body",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	});
	await db.insert(ticketStopwatches).values({
		id: stopwatchId,
		ticketId,
		policyType: "sla",
		policyId,
		targetType: "response",
		startedAt: new Date("2000-01-02T00:00:00Z"),
	});
	try {
		assert.equal(await sweepSla(now, 1), 1);
		assert.equal(await sweepSla(now, 1), 0);
		const [ticket, events] = await Promise.all([
			db.select().from(tickets).where(eq(tickets.id, ticketId)),
			db
				.select()
				.from(slaEscalationEvents)
				.where(eq(slaEscalationEvents.stopwatchId, stopwatchId)),
		]);
		assert.equal(ticket[0]?.escalationFlag, "breach");
		assert.equal(events.length, 1);
	} finally {
		await db.delete(tickets).where(eq(tickets.id, ticketId));
		await db.delete(user).where(eq(user.id, reporterId));
		await db
			.delete(slaNotificationRules)
			.where(eq(slaNotificationRules.id, ruleId));
		await db.delete(slas).where(eq(slas.id, policyId));
		await db.delete(calendars).where(eq(calendars.id, calendarId));
	}
});
