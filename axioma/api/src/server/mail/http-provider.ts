import type { MailProvider, SendRequest } from "./send";

export function createHttpMailProvider(
	url: string,
	token?: string,
): MailProvider {
	return {
		async send(message: SendRequest) {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					...(token ? { authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify(message),
				signal: AbortSignal.timeout(15_000),
			});
			const text = await response.text();
			if (!response.ok)
				throw new Error(
					`Mail webhook returned ${response.status}: ${text.slice(0, 500)}`,
				);
			let messageId: string | undefined;
			try {
				const body = JSON.parse(text) as { messageId?: unknown };
				if (typeof body.messageId === "string") messageId = body.messageId;
			} catch {
				// A successful provider may return plain text.
			}
			return { messageId, text: text.slice(0, 2_000) || "accepted" };
		},
	};
}
