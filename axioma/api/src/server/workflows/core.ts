import { createHmac } from "node:crypto";
import {
	ACTION_TYPES,
	type Action,
	type ActionType,
	actionTypeSet,
	isAction,
} from "../automation/actions";

export type { Action, ActionType };
export { ACTION_TYPES };
export type WorkflowAction = Action;

export function isWorkflowAction(value: unknown): value is WorkflowAction {
	return isAction(value);
}

export function assertWorkflowActions(
	actions: readonly unknown[],
): WorkflowAction[] {
	if (!actions.every(isWorkflowAction))
		throw new TypeError("Unknown workflow action");
	return [...actions];
}

export type WorkflowEvent = Readonly<{
	type: string;
	source: "ticket" | "sla" | "workflow";
}>;

/** Workflow-produced events are deliberately ineligible, preventing workflow loops. */
export function canTriggerWorkflow(event: WorkflowEvent): boolean {
	return event.source !== "workflow";
}

export function signWebhook(body: string | Uint8Array, secret: string): string {
	if (!secret) throw new TypeError("Webhook secret must not be empty");
	return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export type BackoffOptions = Readonly<{
	baseMs?: number;
	maxMs?: number;
	maxAttempts?: number;
}>;

/** Returns null once the bounded delivery has exhausted its attempts. */
export function retryDelayMs(
	attempt: number,
	{ baseMs = 1_000, maxMs = 60_000, maxAttempts = 5 }: BackoffOptions = {},
): number | null {
	for (const [name, value] of Object.entries({
		attempt,
		baseMs,
		maxMs,
		maxAttempts,
	}))
		if (!Number.isSafeInteger(value) || value < 1)
			throw new RangeError(`${name} must be a positive safe integer`);
	if (attempt >= maxAttempts) return null;
	return Math.min(maxMs, baseMs * 2 ** (attempt - 1));
}

export type NotificationEvent = Readonly<{
	recipientId: string;
	actorId?: string | null;
	recordType: string;
	recordId: string;
	eventType: string;
	title: string;
	body: string;
	metadata?: Readonly<Record<string, unknown>>;
}>;

export type CollapsedNotification = NotificationEvent &
	Readonly<{ eventCount: number }>;

export function collapseNotificationRepeats(
	events: readonly NotificationEvent[],
): CollapsedNotification[] {
	const collapsed = new Map<string, CollapsedNotification>();
	for (const event of events) {
		if (event.actorId != null && event.actorId === event.recipientId) continue;
		const key = JSON.stringify([
			event.recipientId,
			event.recordType,
			event.recordId,
			event.eventType,
		]);
		const previous = collapsed.get(key);
		collapsed.set(key, {
			...event,
			eventCount: (previous?.eventCount ?? 0) + 1,
		});
	}
	return [...collapsed.values()];
}

export { actionTypeSet };
