import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	notifications,
	user,
	webhookDeliveries,
	workflowExecutions,
	workflows,
} from "@/db/schema";
import { createSendLogWriter } from "../mail/db";
import { type MailProvider, sendLoggedEmail } from "../mail/send";
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
				const value = action.value as Record<string, unknown> | undefined;
				if (action.type === "send_webhook" && typeof value?.url === "string") {
					const deliveryId = crypto.randomUUID();
					const requestBody = JSON.stringify(input.payload ?? {});
					const requestHeaders: Record<string, string> = {
						"content-type": "application/json",
					};
					if (typeof value.secret === "string" && value.secret)
						requestHeaders["x-axioma-signature"] = signWebhook(
							requestBody,
							value.secret,
						);
					await db.insert(webhookDeliveries).values({
						id: deliveryId,
						executionId: id,
						url: value.url,
						requestBody,
						requestHeaders,
					});
					await deliverWebhook(db, deliveryId);
				}
				if (
					action.type === "send_notification" &&
					typeof value?.recipientId === "string" &&
					value.recipientId !== input.actorId
				) {
					const title =
						typeof value.title === "string" ? value.title : input.type;
					const body = typeof value.body === "string" ? value.body : "";
					await db
						.insert(notifications)
						.values({
							id: crypto.randomUUID(),
							recipientId: value.recipientId,
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
							.where(eq(user.id, value.recipientId))
							.limit(1);
						if (!recipient)
							throw new Error(
								`Notification recipient ${value.recipientId} not found`,
							);
						await sendLoggedEmail({
							provider: notificationMailProvider,
							log: createSendLogWriter(db),
							message: { to: recipient.email, subject: title, text: body },
							subsystem: "notifications",
							ticketId:
								input.recordType === "ticket" ? input.recordId : undefined,
						});
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
