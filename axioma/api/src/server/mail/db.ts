import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { db as defaultDb } from "@/db";
import {
	emailAttachments,
	emailSendLog,
	inboundEmails,
	mailboxActivityLog,
	ticketMailOrigins,
	ticketMessages,
	ticketNumberHistory,
	tickets,
	user,
} from "@/db/schema";
import { prepareFileDocument } from "../documents";
import {
	type CreatedTicket,
	createTicketInTransaction,
	finalizeCreatedTicket,
} from "../tickets/create";
import type { InboundMessage, TicketReference } from "./inbound";
import { planInboundMessage } from "./inbound";
import {
	applyInboundPlan,
	type InboundActivity,
	type MailboxContext,
} from "./process";
import type { SendLogEntry, SendLogWriter } from "./send";

export interface InboundAttachment {
	filename: string;
	contentType: string;
	content: Uint8Array;
	contentId?: string;
}

export interface AttachmentStore {
	put(
		storageKey: string,
		storedFilename: string,
		content: Uint8Array,
	): Promise<void>;
}

export interface ReceivedEmail {
	mailbox: MailboxContext;
	message: InboundMessage;
	receivedAt: Date;
	attachments?: readonly InboundAttachment[];
}

type Database = typeof defaultDb;

export const createSendLogWriter = (database: Database): SendLogWriter => ({
	insert: async (entry: SendLogEntry) => {
		await database.insert(emailSendLog).values(entry);
	},
});

export async function processReceivedEmail(
	database: Database,
	input: ReceivedEmail,
	attachmentStore?: AttachmentStore,
): Promise<string | undefined> {
	const inboundEmailId = crypto.randomUUID();
	try {
		const result = await database.transaction(
			async (
				tx,
			): Promise<{
				ticketId: string | undefined;
				created: CreatedTicket | undefined;
				createdReporterId: string | undefined;
			}> => {
				let created: CreatedTicket | undefined;
				let createdReporterId: string | undefined;
				const [claimed] = await tx
					.insert(inboundEmails)
					.values({
						id: inboundEmailId,
						mailboxId: input.mailbox.id,
						providerMessageId: input.message.providerMessageId,
						fromAddress: input.message.from,
						toAddress: input.message.to,
						subject: input.message.subject,
						textBody: input.message.text,
						headers: Object.fromEntries(
							Object.entries(input.message.headers).filter(
								(entry): entry is [string, string] => entry[1] !== undefined,
							),
						),
						receivedAt: input.receivedAt,
					})
					.onConflictDoNothing()
					.returning({ id: inboundEmails.id });
				if (!claimed) {
					await tx.insert(mailboxActivityLog).values({
						id: crypto.randomUUID(),
						mailboxId: input.mailbox.id,
						decision: "duplicate_ignored",
						reason: `provider message ${input.message.providerMessageId} was already processed`,
					});
					return {
						ticketId: undefined,
						created: undefined,
						createdReporterId: undefined,
					};
				}

				if (input.attachments?.length && !attachmentStore)
					throw new Error("Inbound attachments require an attachment store");
				for (const attachment of input.attachments ?? []) {
					const prepared = prepareFileDocument(
						attachment.filename,
						attachment.content,
					);
					await attachmentStore?.put(
						prepared.storageKey,
						prepared.storedFilename,
						attachment.content,
					);
					await tx.insert(emailAttachments).values({
						id: crypto.randomUUID(),
						inboundEmailId,
						filename: attachment.filename,
						contentType: attachment.contentType,
						storageKey: prepared.storageKey,
						contentId: attachment.contentId,
					});
				}

				const content =
					`${input.message.subject}\n${input.message.text ?? ""}`.toUpperCase();
				const tokens = [...content.matchAll(/\b[A-Z]{2,8}-\d{3,}\b/g)].map(
					([token]) => token,
				);
				const references: TicketReference[] = tokens.length
					? await tx
							.select({
								reference: ticketNumberHistory.number,
								ticketId: ticketNumberHistory.ticketId,
							})
							.from(ticketNumberHistory)
							.where(inArray(ticketNumberHistory.number, tokens))
					: [];
				const [recentReply] = await tx
					.select({ id: emailSendLog.id })
					.from(emailSendLog)
					.where(
						and(
							sql`lower(${emailSendLog.recipient}) = ${input.message.from.trim().toLowerCase()}`,
							eq(emailSendLog.outcome, "sent"),
							gte(emailSendLog.attemptedAt, new Date(Date.now() - 86_400_000)),
						),
					)
					.limit(1);
				const plan = planInboundMessage({
					message: input.message,
					references,
					recentlyAutoReplied: Boolean(recentReply),
				});
				const recordActivity = async (activity: InboundActivity) => {
					await tx.insert(mailboxActivityLog).values({
						id: crypto.randomUUID(),
						mailboxId: input.mailbox.id,
						inboundEmailId,
						...activity,
					});
				};
				const ticketId = await applyInboundPlan({
					message: input.message,
					mailbox: input.mailbox,
					plan,
					actions: {
						appendPublicMessage: async (id, message) => {
							const [ticket] = await tx
								.select({ reporterId: tickets.reporterId })
								.from(tickets)
								.where(eq(tickets.id, id))
								.limit(1);
							if (!ticket)
								throw new Error(`Referenced ticket ${id} was not found`);
							await tx.insert(ticketMessages).values({
								id: crypto.randomUUID(),
								ticketId: id,
								authorId: ticket.reporterId,
								authorType: "reporter",
								body: message.text?.trim() || message.subject,
								visibility: "public",
							});
						},
						createClassifiedTicket: async ({ message, ticketOrigin }) => {
							const normalizedEmail = message.from.trim().toLowerCase();
							if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
								throw new Error("Inbound sender must be a valid email address");
							let [reporter] = await tx
								.select({ id: user.id })
								.from(user)
								.where(sql`lower(${user.email}) = ${normalizedEmail}`)
								.limit(1);
							if (!reporter) {
								[reporter] = await tx
									.insert(user)
									.values({
										id: crypto.randomUUID(),
										name: normalizedEmail,
										email: normalizedEmail,
									})
									.onConflictDoUpdate({
										target: user.email,
										set: { email: normalizedEmail },
									})
									.returning({ id: user.id });
							}
							if (!reporter)
								throw new Error("Could not resolve inbound reporter");
							createdReporterId = reporter.id;
							created = await createTicketInTransaction(tx, {
								source: "email",
								reporterId: createdReporterId,
								title: message.subject,
								body: message.text?.trim() || message.subject,
								origin: ticketOrigin,
							});
							return created.ticketId;
						},
						recordTicketOrigin: async (origin) => {
							await tx
								.insert(ticketMailOrigins)
								.values({ ...origin, inboundEmailId });
						},
						recordActivity,
					},
				});
				await tx
					.update(inboundEmails)
					.set({ status: "processed", processedAt: new Date(), ticketId })
					.where(eq(inboundEmails.id, inboundEmailId));
				return { ticketId, created, createdReporterId };
			},
		);
		if (result.created && result.createdReporterId)
			await finalizeCreatedTicket(result.created, {
				reporterId: result.createdReporterId,
			});
		return result.ticketId;
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		await database.transaction(async (tx) => {
			const [failed] = await tx
				.insert(inboundEmails)
				.values({
					id: inboundEmailId,
					mailboxId: input.mailbox.id,
					providerMessageId: input.message.providerMessageId,
					fromAddress: input.message.from,
					toAddress: input.message.to,
					subject: input.message.subject,
					textBody: input.message.text,
					headers: Object.fromEntries(
						Object.entries(input.message.headers).filter(
							(entry): entry is [string, string] => entry[1] !== undefined,
						),
					),
					status: "failed",
					receivedAt: input.receivedAt,
					processedAt: new Date(),
				})
				.onConflictDoNothing()
				.returning({ id: inboundEmails.id });
			await tx.insert(mailboxActivityLog).values({
				id: crypto.randomUUID(),
				mailboxId: input.mailbox.id,
				inboundEmailId: failed?.id,
				decision: "failed",
				reason,
			});
		});
		throw error;
	}
}
