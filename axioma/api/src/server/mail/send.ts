export interface SendRequest {
	to: string;
	subject: string;
	text: string;
	html?: string;
}

export interface ProviderResult {
	messageId?: string;
	text: string;
}

export interface SendLogEntry {
	id: string;
	recipient: string;
	subsystem: string;
	ticketId?: string;
	templateId?: string;
	subject: string;
	outcome: "sent" | "failed";
	providerMessageId?: string;
	providerText: string;
	attemptedAt: Date;
}

export interface MailProvider {
	send(request: SendRequest): Promise<ProviderResult>;
}

export interface SendLogWriter {
	insert(entry: SendLogEntry): Promise<void>;
}

export class MailSendError extends Error {
	constructor(
		message: string,
		readonly cause: unknown,
	) {
		super(message);
		this.name = "MailSendError";
	}
}

function providerFailureText(error: unknown) {
	if (error instanceof Error && error.message.trim()) return error.message;
	if (typeof error === "string" && error.trim()) return error;
	return String(error);
}

/** Persist the attempt before returning or rethrowing, so provider failures stay inspectable. */
export async function sendLoggedEmail(input: {
	provider: MailProvider;
	log: SendLogWriter;
	message: SendRequest;
	subsystem: string;
	ticketId?: string;
	templateId?: string;
	now?: () => Date;
	id?: () => string;
}): Promise<ProviderResult> {
	const base = {
		id: input.id?.() ?? crypto.randomUUID(),
		recipient: input.message.to,
		subsystem: input.subsystem,
		ticketId: input.ticketId,
		templateId: input.templateId,
		subject: input.message.subject,
		attemptedAt: input.now?.() ?? new Date(),
	};

	let result: ProviderResult;
	try {
		result = await input.provider.send(input.message);
	} catch (error) {
		const providerText = providerFailureText(error);
		await input.log.insert({ ...base, outcome: "failed", providerText });
		throw new MailSendError(providerText, error);
	}

	await input.log.insert({
		...base,
		outcome: "sent",
		providerMessageId: result.messageId,
		providerText: result.text,
	});
	return result;
}
