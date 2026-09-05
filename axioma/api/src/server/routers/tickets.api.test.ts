import assert from "node:assert/strict";
import test from "node:test";
import { createRouterClient, ORPCError } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { ticketMessages, tickets, user } from "@/db/schema";
import type { Capability } from "@/shared";
import { ticketsRouter } from "./tickets";

const context = (userId: string, capabilities: Capability[]) =>
	({
		auth: null,
		session: null,
		userId,
		capabilities: new Set(capabilities),
	}) as never;

test("private note excluded getMyTicket", async () => {
	const suffix = crypto.randomUUID();
	const reporterId = `get-my-ticket-${suffix}`;
	const ticketId = `private-note-${suffix}`;
	await db.insert(user).values({
		id: reporterId,
		name: "Private note test",
		email: `${reporterId}@example.test`,
	});
	await db.insert(tickets).values({
		id: ticketId,
		reporterId,
		title: "Private note visibility",
		body: "Verify private notes stay private.",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	});
	await db.insert(ticketMessages).values([
		{
			id: `public-${suffix}`,
			ticketId,
			authorId: reporterId,
			authorType: "reporter",
			body: "public message",
			visibility: "public",
		},
		{
			id: `private-${suffix}`,
			ticketId,
			authorId: reporterId,
			authorType: "staff",
			body: "private message",
			visibility: "private",
		},
	]);

	try {
		const client = createRouterClient(ticketsRouter, {
			context: context(reporterId, ["ticket.read.own"]),
		});
		const response = await client.getMyTicket({ id: ticketId });
		assert.ok(response);
		assert.deepEqual(
			response.messages.map(({ body }) => body),
			["public message"],
		);
		assert.doesNotMatch(JSON.stringify(response), /private message/);
	} finally {
		await db.delete(tickets).where(eq(tickets.id, ticketId));
		await db.delete(user).where(eq(user.id, reporterId));
	}
});

test("reporter can close or escalate their resolved ticket", async () => {
	const suffix = crypto.randomUUID();
	const reporterId = `reporter-verdict-${suffix}`;
	const closeId = `reporter-close-${suffix}`;
	const escalateId = `reporter-escalate-${suffix}`;
	await db.insert(user).values({
		id: reporterId,
		name: "Reporter verdict test",
		email: `${reporterId}@example.test`,
	});
	await db.insert(tickets).values(
		[closeId, escalateId].map((id) => ({
			id,
			reporterId,
			title: "Reporter resolution verdict",
			body: "Verify reporters can accept or reject their own resolved ticket.",
			serviceId: "svc-general",
			serviceSubcategoryId: "ss-general",
			status: "resolved",
			resolvedAt: new Date(),
		})),
	);

	try {
		const client = createRouterClient(ticketsRouter, {
			context: context(reporterId, [
				"ticket.create",
				"ticket.read.own",
				"ticket.update",
			]),
		});
		assert.equal(
			(await client.updateTicket({ id: closeId, action: "close" })).status,
			"closed",
		);
		const escalated = await client.updateTicket({
			id: escalateId,
			action: "escalate",
			note: "The fix did not work.",
		});
		assert.equal(escalated.status, "escalated");
		assert.equal(escalated.escalationFlag, "warning");
		const otherReporter = createRouterClient(ticketsRouter, {
			context: context(`other-${suffix}`, [
				"ticket.create",
				"ticket.read.own",
				"ticket.update",
			]),
		});
		await assert.rejects(
			() => otherReporter.updateTicket({ id: closeId, action: "close" }),
			(error) => error instanceof ORPCError && error.code === "FORBIDDEN",
		);
	} finally {
		await db.delete(tickets).where(inArray(tickets.id, [closeId, escalateId]));
		await db.delete(user).where(eq(user.id, reporterId));
	}
});

test("unknown pending reason takes precedence over an invalid transition", async () => {
	const suffix = crypto.randomUUID();
	const staffId = `pending-reason-staff-${suffix}`;
	const ticketId = `pending-reason-ticket-${suffix}`;
	await db.insert(user).values({
		id: staffId,
		name: "Pending reason test",
		email: `${staffId}@example.test`,
		kind: "staff",
	});
	await db.insert(tickets).values({
		id: ticketId,
		reporterId: staffId,
		title: "Pending reason precedence",
		body: "Verify validation error precedence.",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
		status: "closed",
		closedAt: new Date(),
	});

	try {
		const client = createRouterClient(ticketsRouter, {
			context: context(staffId, ["ticket.reclassify"]),
		});
		await assert.rejects(
			() =>
				client.updateTicket({
					id: ticketId,
					action: "pend",
					reasonId: `unknown-${suffix}`,
				}),
			(error) =>
				error instanceof ORPCError &&
				error.code === "BAD_REQUEST" &&
				error.message === "Unknown pending reason",
		);
	} finally {
		await db.delete(tickets).where(eq(tickets.id, ticketId));
		await db.delete(user).where(eq(user.id, staffId));
	}
});
