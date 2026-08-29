import assert from "node:assert/strict";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
	searchDocuments,
	ticketAudit,
	ticketNumberHistory,
	ticketStopwatches,
	tickets,
	user,
	workflowExecutions,
	workflows,
} from "@/db/schema";
import { createTicket, type TicketCreationSource } from "./create";

const sources: TicketCreationSource[] = [
	"portal",
	"catalogue",
	"email",
	"channel",
	"recurrence",
];

test("every intake source applies the shared ticket creation invariants", async () => {
	const suffix = crypto.randomUUID();
	const reporterId = `test-ticket-creator-${suffix}`;
	const workflowId = `test-ticket-created-${suffix}`;
	const ticketIds: string[] = [];
	await db.insert(user).values({
		id: reporterId,
		name: "Ticket creation test",
		email: `${reporterId}@example.test`,
	});
	await db.insert(workflows).values({
		id: workflowId,
		name: "Ticket creation test",
		triggerEvent: "ticket.created",
		conditions: [],
		actions: [],
	});

	try {
		for (const source of sources) {
			const created = await createTicket({
				source,
				reporterId,
				title: `  ${source} ticket  `,
				body: "  shared body  ",
				recordType: source === "catalogue" ? "service_request" : "incident",
				impact: "high",
				urgency: "high",
				serviceId: "svc-general",
				serviceSubcategoryId: "ss-general",
			});
			ticketIds.push(created.ticketId);

			const [ticket] = await db
				.select()
				.from(tickets)
				.where(eq(tickets.id, created.ticketId));
			assert.ok(ticket);
			assert.equal(ticket.title, `${source} ticket`);
			assert.equal(ticket.body, "shared body");
			assert.equal(ticket.status, "open");
			assert.equal(ticket.priority, "P1");
			assert.equal(ticket.serviceId, "svc-general");
			assert.equal(ticket.serviceSubcategoryId, "ss-general");
			assert.equal(created.number, ticket.number);

			const [history, audit, search, event, stopwatches] = await Promise.all([
				db
					.select()
					.from(ticketNumberHistory)
					.where(eq(ticketNumberHistory.ticketId, created.ticketId)),
				db
					.select()
					.from(ticketAudit)
					.where(eq(ticketAudit.ticketId, created.ticketId)),
				db
					.select()
					.from(searchDocuments)
					.where(eq(searchDocuments.objectId, created.ticketId)),
				db
					.select()
					.from(workflowExecutions)
					.where(eq(workflowExecutions.recordId, created.ticketId)),
				db
					.select()
					.from(ticketStopwatches)
					.where(eq(ticketStopwatches.ticketId, created.ticketId)),
			]);
			assert.equal(history.length, 1);
			assert.equal(history[0]?.number, created.number);
			assert.ok(audit.length > 0);
			assert.equal(search.length, 1);
			assert.ok(
				event.some(({ triggerEvent }) => triggerEvent === "ticket.created"),
			);
			assert.deepEqual(
				new Set(stopwatches.map(({ policyType }) => policyType)),
				new Set(["sla", "ola"]),
			);
		}
	} finally {
		if (ticketIds.length) {
			await db
				.delete(workflowExecutions)
				.where(inArray(workflowExecutions.recordId, ticketIds));
			await db
				.delete(searchDocuments)
				.where(inArray(searchDocuments.objectId, ticketIds));
			await db
				.delete(ticketNumberHistory)
				.where(inArray(ticketNumberHistory.ticketId, ticketIds));
			await db.delete(tickets).where(inArray(tickets.id, ticketIds));
		}
		await db.delete(workflows).where(eq(workflows.id, workflowId));
		await db.delete(user).where(eq(user.id, reporterId));
	}
});
