import type { InboundMessage, InboundPlan } from "./inbound";

export interface MailboxContext {
	id: string;
	ticketOrigin: string;
}

export interface InboundActivity {
	decision:
		| "threaded"
		| "ticket_created"
		| "auto_reply_suppressed"
		| "rejected"
		| "failed";
	reason: string;
	ticketId?: string;
}

export interface InboundActions {
	appendPublicMessage(ticketId: string, message: InboundMessage): Promise<void>;
	createClassifiedTicket(input: {
		message: InboundMessage;
		mailboxId: string;
		ticketOrigin: string;
	}): Promise<string>;
	recordTicketOrigin(input: {
		ticketId: string;
		mailboxId: string;
		ticketOrigin: string;
	}): Promise<void>;
	recordActivity(activity: InboundActivity): Promise<void>;
}

/** Applies a precomputed decision; adapters should run these writes in one DB transaction. */
export async function applyInboundPlan(input: {
	message: InboundMessage;
	mailbox: MailboxContext;
	plan: InboundPlan;
	actions: InboundActions;
}): Promise<string> {
	try {
		let ticketId = input.plan.ticketId;
		if (input.plan.action === "thread") {
			if (!ticketId)
				throw new Error("A threaded inbound message requires a ticket id");
			await input.actions.appendPublicMessage(ticketId, input.message);
			await input.actions.recordActivity({
				decision: "threaded",
				reason: `matched retained ticket reference ${input.plan.reference}`,
				ticketId,
			});
		} else {
			ticketId = await input.actions.createClassifiedTicket({
				message: input.message,
				mailboxId: input.mailbox.id,
				ticketOrigin: input.mailbox.ticketOrigin,
			});
			await input.actions.recordTicketOrigin({
				ticketId,
				mailboxId: input.mailbox.id,
				ticketOrigin: input.mailbox.ticketOrigin,
			});
			await input.actions.recordActivity({
				decision: "ticket_created",
				reason: input.plan.threadRejectionReason
					? `${input.plan.threadRejectionReason}; classification rules applied`
					: "no retained ticket reference matched; classification rules applied",
				ticketId,
			});
		}

		if (!input.plan.autoReply)
			await input.actions.recordActivity({
				decision: "auto_reply_suppressed",
				reason:
					input.plan.autoReplySuppressionReason ?? "automatic reply suppressed",
				ticketId,
			});
		return ticketId;
	} catch (error) {
		await input.actions.recordActivity({
			decision: "failed",
			reason: error instanceof Error ? error.message : String(error),
			ticketId: input.plan.ticketId,
		});
		throw error;
	}
}
