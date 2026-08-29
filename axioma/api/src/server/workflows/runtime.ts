import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	emailTemplateRules,
	emailTemplates,
	notifications,
	tickets,
	user,
	webhookDeliveries,
	workflowExecutions,
	workflows,
} from "@/db/schema";
import { createSendLogWriter } from "../mail/db";
import { type MailProvider, sendLoggedEmail } from "../mail/send";
import { renderTemplate, selectTemplateRule } from "../mail/templates";
import { assertWorkflowActions, canTriggerWorkflow, signWebhook } from "./core";
import { deliverWebhook } from "./webhooks";

let notificationMailProvider: MailProvider | undefined;

export function setNotificationMailProvider(
	provider: MailProvider | undefined,
) {
	notificationMailProvider = provider;
}

export async function fireEvent(input: {
	type: string;
	source: "ticket" | "sla" | "workflow";
	recordType: string;
	recordId: string;
	actorId?: string;
	payload?: Record<string, unknown>;
}) {
	if (!canTriggerWorkflow(input)) return;
	const matching = await db
		.select()
		.from(workflows)
		.where(
			and(eq(workflows.triggerEvent, input.type), eq(workflows.isActive, true)),
		);
	for (const workflow of matching) {
		const id = crypto.randomUUID();
		try {
			const actions = assertWorkflowActions(workflow.actions);
			await db.insert(workflowExecutions).values({
				id,
				workflowId: workflow.id,
				triggerEvent: input.type,
				recordType: input.recordType,
				recordId: input.recordId,
				input: input.payload ?? {},
				status: "running",
			});
			for (const action of actions) {
				switch (action.type) {
					case "send_webhook": {
						const webhook = action.value;
						const deliveryId = crypto.randomUUID();
						const requestBody = JSON.stringify(input.payload ?? {});
						const requestHeaders: Record<string, string> = {
							"content-type": "application/json",
						};
						if (typeof webhook.secret === "string" && webhook.secret)
							requestHeaders["x-axioma-signature"] = signWebhook(
								requestBody,
								webhook.secret,
							);
						await db.insert(webhookDeliveries).values({
							id: deliveryId,
							executionId: id,
							url: webhook.url,
							requestBody,
							requestHeaders,
						});
						await deliverWebhook(db, deliveryId);
						break;
					}
					case "send_notification": {
						const notification = action.value;
						if (notification.recipientId === input.actorId) break;
						const rawTitle =
							typeof notification.title === "string"
								? notification.title
								: input.type;
						const rawBody =
							typeof notification.body === "string" ? notification.body : "";
						const ticket =
							input.recordType === "ticket"
								? (
										await db
											.select({ number: tickets.number })
											.from(tickets)
											.where(eq(tickets.id, input.recordId))
											.limit(1)
									)[0]
								: undefined;
						const recipientAddress =
							(
								await db
									.select({ email: user.email })
									.from(user)
									.where(eq(user.id, notification.recipientId))
									.limit(1)
							)[0]?.email ?? "";
						const [templateRows, ruleRows] = await Promise.all([
							db
								.select()
								.from(emailTemplates)
								.where(eq(emailTemplates.enabled, true)),
							db
								.select()
								.from(emailTemplateRules)
								.where(eq(emailTemplateRules.enabled, true)),
						]);
						const selected = selectTemplateRule(recipientAddress, ruleRows);
						const template = selected
							? templateRows.find((item) => item.id === selected.templateId)
							: undefined;
						const mergeCodes = {
							ticket_reference: ticket?.number ?? "",
							ticket_url: ticket ? `/tickets/${ticket.number}` : "",
						};
						const title = renderTemplate(
							template?.subject ?? rawTitle,
							mergeCodes,
						);
						const body = renderTemplate(
							template?.textBody ?? rawBody,
							mergeCodes,
						);
						await db
							.insert(notifications)
							.values({
								id: crypto.randomUUID(),
								recipientId: notification.recipientId,
								actorId: input.actorId,
								recordType: input.recordType,
								recordId: input.recordId,
								eventType: input.type,
								title,
								body,
								metadata: input.payload ?? {},
							})
							.onConflictDoUpdate({
								target: [
									notifications.recipientId,
									notifications.recordType,
									notifications.recordId,
									notifications.eventType,
								],
								set: {
									eventCount: sql`${notifications.eventCount} + 1`,
									eventType: input.type,
									actorId: input.actorId,
									updatedAt: new Date(),
								},
							});
						if (notificationMailProvider) {
							const [recipient] = await db
								.select({ email: user.email })
								.from(user)
								.where(eq(user.id, notification.recipientId))
								.limit(1);
							if (!recipient)
								throw new Error(
									`Notification recipient ${notification.recipientId} not found`,
								);
							await sendLoggedEmail({
								provider: notificationMailProvider,
								log: createSendLogWriter(db),
								message: { to: recipient.email, subject: title, text: body },
								subsystem: "notifications",
								ticketId:
									input.recordType === "ticket" ? input.recordId : undefined,
								templateId: template?.id,
							});
						}
						break;
					}
					default: {
						const unsupported: never = action;
						throw new TypeError(`Unsupported workflow action: ${unsupported}`);
					}
				}
			}
			await db
				.update(workflowExecutions)
				.set({ status: "succeeded", finishedAt: new Date() })
				.where(eq(workflowExecutions.id, id));
			await db
				.update(workflows)
				.set({ lastRunStatus: "succeeded", lastRunAt: new Date() })
				.where(eq(workflows.id, workflow.id));
		} catch (error) {
			await db
				.update(workflowExecutions)
				.set({
					status: "failed",
					error: error instanceof Error ? error.message : String(error),
					finishedAt: new Date(),
				})
				.where(eq(workflowExecutions.id, id));
			await db
				.update(workflows)
				.set({ lastRunStatus: "failed", lastRunAt: new Date() })
				.where(eq(workflows.id, workflow.id));
		}
	}
}
