import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	channelMessages,
	emailSendLog,
	emailTemplateRules,
	emailTemplates,
	messagingChannels,
	messagingThreads,
	ticketAudit,
	ticketMessages,
	ticketNumberCounters,
	ticketNumberHistory,
	ticketRuleFirings,
	ticketRules,
	tickets,
} from "@/db/schema";
import { derivePriority } from "@/shared";
import { planThreadIngestion } from "../channel-ingestion";
import { capabilityProcedure } from "../orpc";
import { evaluateTicketRules } from "../rules";
import { indexTicket } from "../search/projections";
import { attachTicketStopwatches } from "../sla/runtime";
import { formatTicketNumber } from "../ticket-records";

export const mailRouter = {
	ingestChannelMessage: capabilityProcedure(
		"ticket.create",
	).ingestChannelMessage.handler(async ({ context, input }) => {
		const planned = planThreadIngestion(input, null);
		const result = await db.transaction(async (tx) => {
			const [channel] = await tx
				.insert(messagingChannels)
				.values({
					id: crypto.randomUUID(),
					key: planned.ruleFacts.channelKey,
					name: input.channelKey.trim(),
					kind: input.channelKind,
				})
				.onConflictDoUpdate({
					target: messagingChannels.key,
					set: { name: input.channelKey.trim() },
				})
				.returning();
			if (!channel || channel.kind !== input.channelKind)
				throw new ORPCError("CONFLICT", {
					message: "Channel kind does not match existing channel",
				});
			let [thread] = await tx
				.select()
				.from(messagingThreads)
				.where(
					and(
						eq(messagingThreads.channelId, channel.id),
						eq(
							messagingThreads.externalThreadId,
							input.externalThreadId.trim(),
						),
					),
				)
				.limit(1);
			if (!thread)
				[thread] = await tx
					.insert(messagingThreads)
					.values({
						id: crypto.randomUUID(),
						channelId: channel.id,
						externalThreadId: input.externalThreadId.trim(),
						originKey: planned.originKey,
						participantRef: input.senderRef?.trim(),
						openedAt: input.receivedAt,
						lastMessageAt: input.receivedAt,
					})
					.returning();
			if (!thread) throw new ORPCError("INTERNAL_SERVER_ERROR");
			const [message] = await tx
				.insert(channelMessages)
				.values({
					id: crypto.randomUUID(),
					threadId: thread.id,
					externalMessageId: input.externalMessageId.trim(),
					direction: "inbound",
					senderRef: input.senderRef?.trim(),
					body: input.body.trim(),
					raw: input.raw,
					receivedAt: input.receivedAt,
				})
				.onConflictDoNothing()
				.returning();
			if (!message) {
				const [existing] = await tx
					.select({ id: channelMessages.id })
					.from(channelMessages)
					.where(
						and(
							eq(channelMessages.threadId, thread.id),
							eq(
								channelMessages.externalMessageId,
								input.externalMessageId.trim(),
							),
						),
					);
				if (!thread.ticketId || !existing) throw new ORPCError("CONFLICT");
				return {
					duplicate: true,
					ticketId: thread.ticketId,
					threadId: thread.id,
					messageId: existing.id,
					created: false,
				};
			}
			if (thread.ticketId) {
				await tx.insert(ticketMessages).values({
					id: crypto.randomUUID(),
					ticketId: thread.ticketId,
					authorId: context.userId,
					authorType: "reporter",
					body: input.body.trim(),
					visibility: "public",
				});
				await tx
					.update(messagingThreads)
					.set({ lastMessageAt: input.receivedAt })
					.where(eq(messagingThreads.id, thread.id));
				return {
					duplicate: false,
					ticketId: thread.ticketId,
					threadId: thread.id,
					messageId: message.id,
					created: false,
				};
			}
			const title =
				input.title ?? input.body.trim().split(/\r?\n/, 1)[0]!.slice(0, 160);
			const evaluation = evaluateTicketRules(
				{
					title,
					body: input.body.trim(),
					requesterId: context.userId,
					origin: thread.originKey,
					recordType: "incident",
					impact: "medium",
					urgency: "medium",
				},
				await tx
					.select()
					.from(ticketRules)
					.where(eq(ticketRules.enabled, true)),
			);
			const ticketId = crypto.randomUUID();
			const year = String(input.receivedAt.getUTCFullYear());
			const counter = (
				await tx
					.insert(ticketNumberCounters)
					.values({ prefix: "INC", year, lastValue: 1 })
					.onConflictDoUpdate({
						target: [ticketNumberCounters.prefix, ticketNumberCounters.year],
						set: { lastValue: sql`${ticketNumberCounters.lastValue} + 1` },
					})
					.returning({ value: ticketNumberCounters.lastValue })
			)[0]!;
			const number = formatTicketNumber(
				"incident",
				Number(year),
				counter.value,
			);
			await tx.insert(tickets).values({
				id: ticketId,
				number,
				reporterId: context.userId,
				title,
				body: input.body.trim(),
				recordType: evaluation.ticket.recordType,
				impact: evaluation.ticket.impact,
				urgency: evaluation.ticket.urgency,
				priority: derivePriority(
					evaluation.ticket.impact,
					evaluation.ticket.urgency,
				),
				category: evaluation.ticket.category,
				route: evaluation.ticket.route,
				teamId: evaluation.ticket.teamId,
				assigneeId: evaluation.ticket.assigneeId,
			});
			await tx.insert(ticketNumberHistory).values({ number, ticketId });
			if (evaluation.firings.length) {
				await tx.insert(ticketRuleFirings).values(
					evaluation.firings.map((firing) => ({
						id: crypto.randomUUID(),
						ticketId,
						ruleId: firing.ruleId,
						rulePosition: firing.rulePosition,
						result: firing,
					})),
				);
				await tx.insert(ticketAudit).values(
					evaluation.firings.flatMap((firing) =>
						firing.applied.map((action) => ({
							id: crypto.randomUUID(),
							ticketId,
							fieldName: action.type,
							oldValue: null,
							newValue: "value" in action ? action.value : true,
							actorId: `rule:${firing.ruleId}`,
						})),
					),
				);
			}
			await tx
				.update(messagingThreads)
				.set({ ticketId, lastMessageAt: input.receivedAt })
				.where(eq(messagingThreads.id, thread.id));
			return {
				duplicate: false,
				ticketId,
				threadId: thread.id,
				messageId: message.id,
				created: true,
			};
		});
		if (result.created) {
			await attachTicketStopwatches(result.ticketId, "P3");
			await indexTicket(db, result.ticketId);
		}
		return {
			accepted: true as const,
			duplicate: result.duplicate,
			ticketId: result.ticketId,
			threadId: result.threadId,
			messageId: result.messageId,
		};
	}),
	listEmailTemplates: capabilityProcedure(
		"admin.settings",
	).listEmailTemplates.handler(() =>
		db
			.select({
				id: emailTemplates.id,
				name: emailTemplates.name,
				subject: emailTemplates.subject,
				textBody: emailTemplates.textBody,
				htmlBody: emailTemplates.htmlBody,
				enabled: emailTemplates.enabled,
			})
			.from(emailTemplates)
			.orderBy(asc(emailTemplates.name)),
	),
	createEmailTemplate: capabilityProcedure(
		"admin.settings",
	).createEmailTemplate.handler(async ({ input }) => {
		const [row] = await db
			.insert(emailTemplates)
			.values({ id: crypto.randomUUID(), ...input })
			.returning();
		if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return row;
	}),
	updateEmailTemplate: capabilityProcedure(
		"admin.settings",
	).updateEmailTemplate.handler(async ({ input: { id, ...input } }) => {
		const [row] = await db
			.update(emailTemplates)
			.set(input)
			.where(eq(emailTemplates.id, id))
			.returning();
		if (!row) throw new ORPCError("NOT_FOUND");
		return row;
	}),
	deleteEmailTemplate: capabilityProcedure(
		"admin.settings",
	).deleteEmailTemplate.handler(async ({ input }) => ({
		deleted: Boolean(
			(
				await db
					.delete(emailTemplates)
					.where(eq(emailTemplates.id, input.id))
					.returning({ id: emailTemplates.id })
			)[0],
		),
	})),
	listEmailTemplateRules: capabilityProcedure(
		"admin.settings",
	).listEmailTemplateRules.handler(() =>
		db
			.select()
			.from(emailTemplateRules)
			.orderBy(asc(emailTemplateRules.createdAt)),
	),
	setEmailTemplateRule: capabilityProcedure(
		"admin.settings",
	).setEmailTemplateRule.handler(async ({ input }) => {
		const id = input.id ?? crypto.randomUUID();
		const { id: _id, ...values } = { ...input, id };
		const [row] = await db
			.insert(emailTemplateRules)
			.values({ id, ...values })
			.onConflictDoUpdate({ target: emailTemplateRules.id, set: values })
			.returning();
		if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return row;
	}),
	deleteEmailTemplateRule: capabilityProcedure(
		"admin.settings",
	).deleteEmailTemplateRule.handler(async ({ input }) => ({
		deleted: Boolean(
			(
				await db
					.delete(emailTemplateRules)
					.where(eq(emailTemplateRules.id, input.id))
					.returning({ id: emailTemplateRules.id })
			)[0],
		),
	})),
	listEmailSendLog: capabilityProcedure(
		"admin.settings",
	).listEmailSendLog.handler(({ input }) =>
		db
			.select()
			.from(emailSendLog)
			.where(
				input.ticketId ? eq(emailSendLog.ticketId, input.ticketId) : undefined,
			)
			.orderBy(desc(emailSendLog.attemptedAt))
			.limit(input.limit),
	),
};
