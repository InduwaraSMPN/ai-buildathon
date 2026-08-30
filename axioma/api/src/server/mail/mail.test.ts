import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { inboundEmails, mailboxes, ticketOrigins } from "@/db/schema";
import { processReceivedEmail } from "./db";
import {
	autoReplySuppressionReason,
	findTicketReference,
	type InboundMessage,
	planInboundMessage,
} from "./inbound";
import { createMailboxPoller } from "./poller";
import { applyInboundPlan, type InboundActivity } from "./process";
import { MailSendError, type SendLogEntry, sendLoggedEmail } from "./send";
import {
	renderTemplate,
	selectTemplateRule,
	type TemplateRule,
} from "./templates";

const message = (overrides: Partial<InboundMessage> = {}): InboundMessage => ({
	providerMessageId: "provider-1",
	from: "person@example.com",
	to: "helpdesk@example.net",
	subject: "Printer issue",
	text: "Please help",
	headers: {},
	...overrides,
});

test("threading uses retained references in subject or body and never subject similarity", () => {
	const references = [
		{ reference: "INC-2026-00042", ticketId: "ticket-new" },
		{ reference: "OLD-0042", ticketId: "ticket-new" },
	];
	assert.equal(
		findTicketReference(message({ subject: "Re: printer issue" }), references),
		undefined,
	);
	assert.deepEqual(
		findTicketReference(
			message({ subject: "Fwd: [OLD-0042] printer" }),
			references,
		),
		references[1],
	);
	assert.deepEqual(
		findTicketReference(
			message({ text: "Regarding INC-2026-00042." }),
			references,
		),
		references[0],
	);
});

test("known responder, list, bounce, and recent-send signals suppress automatic replies", () => {
	assert.equal(
		autoReplySuppressionReason(
			message({ headers: { "Auto-Submitted": "auto-replied" } }),
			false,
		),
		"Auto-Submitted: auto-replied",
	);
	assert.equal(
		autoReplySuppressionReason(
			message({ headers: { "List-Id": "staff.example" } }),
			false,
		),
		"List-Id",
	);
	assert.equal(
		autoReplySuppressionReason(
			message({ headers: { "Return-Path": "<>" } }),
			false,
		),
		"empty Return-Path",
	);
	assert.equal(
		autoReplySuppressionReason(message(), true),
		"sender recently received an automatic reply",
	);
	assert.equal(autoReplySuppressionReason(message(), false), undefined);
});

test("unmatched inbound mail creates a classified ticket with mailbox origin and logs decisions", async () => {
	const activities: InboundActivity[] = [];
	const origins: unknown[] = [];
	const plan = planInboundMessage({
		message: message({ headers: { Precedence: "bulk" } }),
		references: [],
		recentlyAutoReplied: false,
	});
	const ticketId = await applyInboundPlan({
		message: message(),
		mailbox: { id: "alerts", ticketOrigin: "monitoring" },
		plan,
		actions: {
			appendPublicMessage: async () => assert.fail("must create, not thread"),
			createClassifiedTicket: async (input) => {
				assert.equal(input.ticketOrigin, "monitoring");
				return "ticket-1";
			},
			recordTicketOrigin: async (origin) => {
				origins.push(origin);
			},
			recordActivity: async (activity) => {
				activities.push(activity);
			},
		},
	});
	assert.equal(ticketId, "ticket-1");
	assert.deepEqual(origins, [
		{ ticketId: "ticket-1", mailboxId: "alerts", ticketOrigin: "monitoring" },
	]);
	assert.deepEqual(
		activities.map(({ decision }) => decision),
		["ticket_created", "auto_reply_suppressed"],
	);
});

test("matched inbound mail appends a public message to the referenced ticket", async () => {
	let appended: string | undefined;
	const activities: InboundActivity[] = [];
	await applyInboundPlan({
		message: message(),
		mailbox: { id: "helpdesk", ticketOrigin: "employee_email" },
		plan: {
			action: "thread",
			ticketId: "ticket-7",
			reference: "INC-7",
			autoReply: true,
		},
		actions: {
			appendPublicMessage: async (ticketId) => {
				appended = ticketId;
			},
			createClassifiedTicket: async () =>
				assert.fail("must thread, not create"),
			recordTicketOrigin: async () =>
				assert.fail("existing ticket origin stays unchanged"),
			recordActivity: async (activity) => {
				activities.push(activity);
			},
		},
	});
	assert.equal(appended, "ticket-7");
	assert.equal(activities[0]?.decision, "threaded");
});

test("template rule selection uses specificity rather than row order", () => {
	const rules: TemplateRule[] = [
		{ id: "a", templateId: "catch", scope: "catch_all", enabled: true },
		{
			id: "b",
			templateId: "domain",
			scope: "domain",
			matchValue: "example.com",
			enabled: true,
		},
		{
			id: "c",
			templateId: "address",
			scope: "address",
			matchValue: "vip@example.com",
			enabled: true,
		},
	];
	assert.equal(
		selectTemplateRule("user@example.com", rules)?.templateId,
		"domain",
	);
	assert.equal(
		selectTemplateRule("user@example.com", rules.toReversed())?.templateId,
		"domain",
	);
	assert.equal(
		selectTemplateRule("VIP@EXAMPLE.COM", rules)?.templateId,
		"address",
	);
	assert.equal(
		selectTemplateRule("user@elsewhere.net", rules)?.templateId,
		"catch",
	);
});

test("template merge codes include reporter ticket URLs", () => {
	assert.equal(
		renderTemplate("Open [ticket_reference] at [ticket_url].", {
			ticket_reference: "INC-42",
			ticket_url: "https://portal.example/tickets/42",
		}),
		"Open INC-42 at https://portal.example/tickets/42.",
	);
});

test("every provider attempt is logged with provider text", async () => {
	const entries: SendLogEntry[] = [];
	const log = {
		insert: async (entry: SendLogEntry) => {
			entries.push(entry);
		},
	};
	const common = {
		log,
		message: { to: "person@example.com", subject: "Update", text: "Done" },
		subsystem: "notifications",
		id: () => "attempt-1",
		now: () => new Date("2026-01-01T00:00:00Z"),
	};
	await sendLoggedEmail({
		...common,
		provider: {
			send: async () => ({ messageId: "remote-1", text: "250 accepted" }),
		},
	});
	assert.equal(entries[0]?.providerText, "250 accepted");
	assert.equal(entries[0]?.outcome, "sent");

	await assert.rejects(
		sendLoggedEmail({
			...common,
			provider: {
				send: async () => Promise.reject(new Error("550 mailbox unavailable")),
			},
		}),
		(error) =>
			error instanceof MailSendError &&
			error.message === "550 mailbox unavailable",
	);
	assert.equal(entries[1]?.providerText, "550 mailbox unavailable");
	assert.equal(entries[1]?.outcome, "failed");
});

test("mailbox poller processes before acknowledgement and closes cleanly", async () => {
	const calls: string[] = [];
	const poller = createMailboxPoller({
		intervalMs: 60_000,
		listMailboxes: async () => [
			{ id: "helpdesk", ticketOrigin: "employee_email" },
		],
		provider: {
			poll: async () => [
				{
					message: message(),
					receivedAt: new Date("2026-01-01T00:00:00Z"),
				},
			],
			acknowledge: async () => {
				calls.push("acknowledge");
			},
		},
		process: async (received) => {
			calls.push(`process:${received.mailbox.id}`);
		},
	});
	await poller.start();
	await poller.close();
	assert.deepEqual(calls, ["process:helpdesk", "acknowledge"]);
});

test("mailbox poller never acknowledges failed processing", async () => {
	let acknowledged = false;
	const poller = createMailboxPoller({
		intervalMs: 60_000,
		listMailboxes: async () => [
			{ id: "helpdesk", ticketOrigin: "employee_email" },
		],
		provider: {
			poll: async () => [
				{
					message: message(),
					receivedAt: new Date("2026-01-01T00:00:00Z"),
				},
			],
			acknowledge: async () => {
				acknowledged = true;
			},
		},
		process: async () => Promise.reject(new Error("database unavailable")),
	});
	await poller.start();
	await poller.close();
	assert.equal(acknowledged, false);
});

test("poison inbound mail persists attempts and stops retrying at the cap", async () => {
	const mailboxId = crypto.randomUUID();
	const providerMessageId = crypto.randomUUID();
	const originKey = `poison-${mailboxId}`;
	await db.insert(ticketOrigins).values({
		id: crypto.randomUUID(),
		key: originKey,
		name: "Poison test",
	});
	await db.insert(mailboxes).values({
		id: mailboxId,
		address: `${mailboxId}@example.test`,
		name: "Poison test",
		ticketOrigin: originKey,
	});
	const input = {
		mailbox: { id: mailboxId, ticketOrigin: originKey },
		message: message({ providerMessageId }),
		receivedAt: new Date(),
		attachments: [
			{
				filename: "note.txt",
				contentType: "text/plain",
				content: new Uint8Array([1]),
			},
		],
	};
	try {
		for (let attempt = 1; attempt <= 3; attempt++) {
			await assert.rejects(processReceivedEmail(db, input), /attachment store/);
			const [row] = await db
				.select()
				.from(inboundEmails)
				.where(
					and(
						eq(inboundEmails.mailboxId, mailboxId),
						eq(inboundEmails.providerMessageId, providerMessageId),
					),
				);
			assert.equal(row?.attemptCount, attempt);
		}
		assert.equal(await processReceivedEmail(db, input), undefined);
		const [row] = await db
			.select()
			.from(inboundEmails)
			.where(eq(inboundEmails.providerMessageId, providerMessageId));
		assert.equal(row?.attemptCount, 3);
		assert.equal(row?.status, "failed");
	} finally {
		await db
			.delete(inboundEmails)
			.where(eq(inboundEmails.mailboxId, mailboxId));
		await db.delete(mailboxes).where(eq(mailboxes.id, mailboxId));
		await db.delete(ticketOrigins).where(eq(ticketOrigins.key, originKey));
	}
});

test("inbound attachment preparation rejects executable names", async () => {
	const { prepareFileDocument } = await import("../documents");
	assert.throws(
		() => prepareFileDocument("invoice.exe", new Uint8Array([1])),
		/not allowed/,
	);
});
