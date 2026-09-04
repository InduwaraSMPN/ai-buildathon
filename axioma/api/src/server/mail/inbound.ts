export interface InboundMessage {
	providerMessageId: string;
	from: string;
	to: string;
	subject: string;
	text?: string;
	headers: Record<string, string | undefined>;
}

export interface TicketReference {
	reference: string;
	ticketId: string;
}

export interface InboundPlan {
	action: "thread" | "create";
	ticketId?: string;
	reference?: string;
	autoReply: boolean;
	autoReplySuppressionReason?: string;
	/** Set when a reference matched but the sender was not entitled to it. */
	threadRejectionReason?: string;
}

const autoResponderHeaders = new Set([
	"auto-replied",
	"auto-generated",
	"auto-notified",
]);

function header(message: InboundMessage, name: string) {
	const found = Object.entries(message.headers).find(
		([key]) => key.toLowerCase() === name.toLowerCase(),
	);
	return found?.[1]?.trim();
}

export function autoReplySuppressionReason(
	message: InboundMessage,
	recentlyAutoReplied: boolean,
): string | undefined {
	const autoSubmitted = header(message, "auto-submitted")?.toLowerCase();
	if (
		autoSubmitted &&
		autoSubmitted !== "no" &&
		autoResponderHeaders.has(autoSubmitted)
	)
		return `Auto-Submitted: ${autoSubmitted}`;

	const precedence = header(message, "precedence")?.toLowerCase();
	if (precedence && ["bulk", "junk", "list"].includes(precedence))
		return `Precedence: ${precedence}`;

	if (header(message, "x-auto-response-suppress"))
		return "X-Auto-Response-Suppress";
	if (header(message, "list-id")) return "List-Id";
	if (header(message, "return-path") === "<>") return "empty Return-Path";
	if (recentlyAutoReplied) return "sender recently received an automatic reply";
	return undefined;
}

/** Match only explicit retained references; subject similarity is deliberately irrelevant. */
export function findTicketReference(
	message: Pick<InboundMessage, "subject" | "text">,
	references: readonly TicketReference[],
): TicketReference | undefined {
	const content = `${message.subject}\n${message.text ?? ""}`.toLocaleUpperCase(
		"en-US",
	);
	return references.find(({ reference }) => {
		const escaped = reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		return new RegExp(`(^|[^A-Z0-9])${escaped}($|[^A-Z0-9])`, "i").test(
			content,
		);
	});
}

export function planInboundMessage(input: {
	message: InboundMessage;
	references: readonly TicketReference[];
	/**
	 * References the sender is not entitled to thread onto. Ticket numbers are
	 * sequential and appear in every outbound notification, so quoting one is no
	 * evidence of anything; these are carried only to explain the fall-through.
	 */
	unauthorizedReferences?: readonly TicketReference[];
	recentlyAutoReplied: boolean;
}): InboundPlan {
	const match = findTicketReference(input.message, input.references);
	const rejected = match
		? undefined
		: findTicketReference(input.message, input.unauthorizedReferences ?? []);
	const suppression = autoReplySuppressionReason(
		input.message,
		input.recentlyAutoReplied,
	);
	return {
		action: match ? "thread" : "create",
		ticketId: match?.ticketId,
		reference: match?.reference,
		autoReply: suppression === undefined,
		autoReplySuppressionReason: suppression,
		threadRejectionReason: rejected
			? `sender is not the reporter of ${rejected.reference}`
			: undefined,
	};
}
