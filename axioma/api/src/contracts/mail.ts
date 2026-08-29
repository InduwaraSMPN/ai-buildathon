import { oc } from "@orpc/contract";
import { z } from "zod";

const templateRule = z.object({
	id: z.string(),
	templateId: z.string(),
	scope: z.enum(["catch_all", "domain", "address"]),
	matchValue: z.string().nullable(),
	enabled: z.boolean(),
});

const emailTemplate = z.object({
	id: z.string(),
	name: z.string(),
	subject: z.string(),
	textBody: z.string(),
	htmlBody: z.string().nullable(),
	enabled: z.boolean(),
});

const templateInput = emailTemplate.omit({ id: true });
const mailbox = z.object({
	id: z.string(),
	address: z.string(),
	name: z.string(),
	ticketOrigin: z.string(),
	enabled: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
});
const mailboxActivity = z.object({
	id: z.string(),
	mailboxId: z.string(),
	inboundEmailId: z.string().nullable(),
	decision: z.string(),
	reason: z.string(),
	ticketId: z.string().nullable(),
	createdAt: z.date(),
});

export const mailContract = {
	listMailboxes: oc.output(z.array(mailbox)),
	upsertMailbox: oc
		.input(
			mailbox.omit({ createdAt: true, updatedAt: true }).partial({ id: true }),
		)
		.output(mailbox),
	deleteMailbox: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(z.object({ deleted: z.boolean() })),
	listMailboxActivity: oc
		.input(
			z.object({
				mailboxId: z.string().optional(),
				limit: z.number().int().min(1).max(100).default(50),
			}),
		)
		.output(z.array(mailboxActivity)),
	ingestChannelMessage: oc
		.input(
			z.object({
				channelKey: z.string().trim().min(1).max(100),
				channelKind: z.enum(["webchat", "sms", "social", "other"]),
				externalThreadId: z.string().trim().min(1).max(255),
				externalMessageId: z.string().trim().min(1).max(255),
				title: z.string().trim().min(1).max(160).optional(),
				body: z.string().trim().min(1).max(10_000),
				senderRef: z.string().trim().max(255).optional(),
				origin: z.string().trim().max(100).optional(),
				receivedAt: z.coerce.date().default(() => new Date()),
				raw: z.unknown().optional(),
			}),
		)
		.output(
			z.object({
				accepted: z.literal(true),
				duplicate: z.boolean(),
				ticketId: z.string(),
				threadId: z.string(),
				messageId: z.string(),
			}),
		),
	listEmailTemplates: oc.output(z.array(emailTemplate)),
	createEmailTemplate: oc.input(templateInput).output(emailTemplate),
	updateEmailTemplate: oc
		.input(templateInput.partial().extend({ id: z.string().min(1) }))
		.output(emailTemplate),
	deleteEmailTemplate: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(z.object({ deleted: z.boolean() })),
	listEmailTemplateRules: oc.output(z.array(templateRule)),
	setEmailTemplateRule: oc
		.input(
			templateRule.omit({ id: true }).extend({ id: z.string().optional() }),
		)
		.output(templateRule),
	deleteEmailTemplateRule: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(z.object({ deleted: z.boolean() })),
	listEmailSendLog: oc
		.input(
			z.object({
				ticketId: z.string().optional(),
				limit: z.number().int().min(1).max(100).default(50),
			}),
		)
		.output(
			z.array(
				z.object({
					id: z.string(),
					recipient: z.string(),
					subsystem: z.string(),
					ticketId: z.string().nullable(),
					templateId: z.string().nullable(),
					subject: z.string(),
					outcome: z.enum(["sent", "failed"]),
					providerMessageId: z.string().nullable(),
					providerText: z.string(),
					attemptedAt: z.date(),
				}),
			),
		),
};
