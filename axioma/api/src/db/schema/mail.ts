import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { tickets } from "./tickets";

export const INBOUND_EMAIL_STATUSES = [
	"received",
	"processed",
	"rejected",
	"failed",
] as const;
export const MAILBOX_ACTIVITY_DECISIONS = [
	"threaded",
	"ticket_created",
	"auto_reply_suppressed",
	"duplicate_ignored",
	"rejected",
	"failed",
] as const;
export const EMAIL_SEND_OUTCOMES = ["sent", "failed"] as const;

/** One receiving address and the origin assigned to tickets created through it. */
export const mailboxes = pgTable("mailboxes", {
	id: text("id").primaryKey(),
	address: text("address").notNull().unique(),
	name: text("name").notNull(),
	ticketOrigin: text("ticket_origin").notNull(),
	enabled: boolean("enabled").notNull().default(true),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const inboundEmails = pgTable(
	"inbound_emails",
	{
		id: text("id").primaryKey(),
		mailboxId: text("mailbox_id")
			.notNull()
			.references(() => mailboxes.id, { onDelete: "restrict" }),
		providerMessageId: text("provider_message_id").notNull(),
		fromAddress: text("from_address").notNull(),
		toAddress: text("to_address").notNull(),
		subject: text("subject").notNull(),
		textBody: text("text_body"),
		htmlBody: text("html_body"),
		headers: jsonb("headers")
			.$type<Record<string, string>>()
			.notNull()
			.default({}),
		status: text("status", { enum: INBOUND_EMAIL_STATUSES })
			.notNull()
			.default("received"),
		ticketId: text("ticket_id").references(() => tickets.id, {
			onDelete: "set null",
		}),
		receivedAt: timestamp("received_at").notNull(),
		processedAt: timestamp("processed_at"),
	},
	(t) => [
		uniqueIndex("inbound_emails_mailbox_provider_uidx").on(
			t.mailboxId,
			t.providerMessageId,
		),
		index("inbound_emails_ticket_idx").on(t.ticketId, t.receivedAt),
	],
);

export const emailAttachments = pgTable(
	"email_attachments",
	{
		id: text("id").primaryKey(),
		inboundEmailId: text("inbound_email_id")
			.notNull()
			.references(() => inboundEmails.id, { onDelete: "cascade" }),
		filename: text("filename").notNull(),
		contentType: text("content_type").notNull(),
		storageKey: text("storage_key").notNull(),
		contentId: text("content_id"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [index("email_attachments_inbound_idx").on(t.inboundEmailId)],
);

/** Durable explanation of every inbound decision, including suppressions and failures. */
export const mailboxActivityLog = pgTable(
	"mailbox_activity_log",
	{
		id: text("id").primaryKey(),
		mailboxId: text("mailbox_id")
			.notNull()
			.references(() => mailboxes.id, { onDelete: "cascade" }),
		inboundEmailId: text("inbound_email_id").references(
			() => inboundEmails.id,
			{
				onDelete: "set null",
			},
		),
		decision: text("decision", { enum: MAILBOX_ACTIVITY_DECISIONS }).notNull(),
		reason: text("reason").notNull(),
		ticketId: text("ticket_id").references(() => tickets.id, {
			onDelete: "set null",
		}),
		details: jsonb("details").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [index("mailbox_activity_mailbox_idx").on(t.mailboxId, t.createdAt)],
);

/** Isolated ticket provenance avoids modifying the concurrently-owned tickets table. */
export const ticketMailOrigins = pgTable(
	"ticket_mail_origins",
	{
		ticketId: text("ticket_id")
			.primaryKey()
			.references(() => tickets.id, { onDelete: "cascade" }),
		mailboxId: text("mailbox_id")
			.notNull()
			.references(() => mailboxes.id, { onDelete: "restrict" }),
		ticketOrigin: text("ticket_origin").notNull(),
		inboundEmailId: text("inbound_email_id")
			.notNull()
			.references(() => inboundEmails.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [index("ticket_mail_origins_mailbox_idx").on(t.mailboxId)],
);

/** One row per provider call, whether it returned or threw. */
export const emailSendLog = pgTable(
	"email_send_log",
	{
		id: text("id").primaryKey(),
		recipient: text("recipient").notNull(),
		subsystem: text("subsystem").notNull(),
		ticketId: text("ticket_id").references(() => tickets.id, {
			onDelete: "set null",
		}),
		templateId: text("template_id"),
		subject: text("subject").notNull(),
		outcome: text("outcome", { enum: EMAIL_SEND_OUTCOMES }).notNull(),
		providerMessageId: text("provider_message_id"),
		providerText: text("provider_text").notNull(),
		attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
	},
	(t) => [
		index("email_send_log_ticket_idx").on(t.ticketId, t.attemptedAt),
		index("email_send_log_recipient_idx").on(t.recipient, t.attemptedAt),
	],
);
