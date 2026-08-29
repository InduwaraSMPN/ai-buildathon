export type ChannelKind = "webchat" | "sms" | "social" | "other";

export type IncomingChannelMessage = {
	channelKey: string;
	channelKind: ChannelKind;
	externalThreadId: string;
	externalMessageId: string;
	body: string;
	senderRef?: string;
	origin?: string;
	receivedAt: Date;
};

export type KnownChannelThread = { id: string; ticketId: string | null };

const cleanKey = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

export function normalizeChannelOrigin(
	input: Pick<IncomingChannelMessage, "origin" | "channelKey" | "channelKind">,
): string {
	return cleanKey(input.origin ?? input.channelKey) || input.channelKind;
}

export function planThreadIngestion(
	message: IncomingChannelMessage,
	thread: KnownChannelThread | null,
) {
	const body = message.body.trim();
	if (!body) throw new Error("Channel message body is required");
	const channelKey = cleanKey(message.channelKey);
	if (!channelKey) throw new Error("Channel key is required");
	if (!message.externalThreadId.trim() || !message.externalMessageId.trim()) {
		throw new Error("External thread and message ids are required");
	}

	const originKey = normalizeChannelOrigin(message);
	return {
		deduplicationKey: `${channelKey}:${message.externalThreadId.trim()}:${message.externalMessageId.trim()}`,
		originKey,
		threadAction: thread ? "reuse" : "create",
		ticketAction: thread?.ticketId ? "append-case-log" : "create-via-rules",
		caseLog: thread?.ticketId
			? {
					ticketId: thread.ticketId,
					body,
					visibility: "public" as const,
					source: "channel" as const,
				}
			: null,
		ruleFacts: {
			channel: message.channelKind,
			channelKey,
			origin: originKey,
			sender: message.senderRef?.trim() || null,
			body,
		},
	};
}
