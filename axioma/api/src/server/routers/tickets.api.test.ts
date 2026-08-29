import assert from "node:assert/strict";
import test from "node:test";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
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
