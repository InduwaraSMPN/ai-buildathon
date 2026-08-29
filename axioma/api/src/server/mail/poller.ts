import { eq } from "drizzle-orm";
import type { db as defaultDb } from "@/db";
import { mailboxes } from "@/db/schema";
import {
	type AttachmentStore,
	processReceivedEmail,
	type ReceivedEmail,
} from "./db";
import type { MailboxContext } from "./process";

export interface MailboxProvider {
	poll(
		mailbox: MailboxContext,
	): Promise<readonly Omit<ReceivedEmail, "mailbox">[]>;
	acknowledge?(
		mailbox: MailboxContext,
		providerMessageId: string,
	): Promise<void>;
}

export interface MailboxPoller {
	start(): Promise<void>;
	close(): Promise<void>;
}

type PollerOptions = {
	provider: MailboxProvider;
	listMailboxes: () => Promise<readonly MailboxContext[]>;
	process: (message: ReceivedEmail) => Promise<unknown>;
	intervalMs?: number;
	onError?: (error: unknown) => void;
};

export function createMailboxPoller(options: PollerOptions): MailboxPoller {
	const intervalMs = options.intervalMs ?? 30_000;
	let timer: NodeJS.Timeout | undefined;
	let running: Promise<void> | undefined;
	let closed = false;

	const poll = async () => {
		for (const mailbox of await options.listMailboxes()) {
			for (const incoming of await options.provider.poll(mailbox)) {
				await options.process({ ...incoming, mailbox });
				await options.provider.acknowledge?.(
					mailbox,
					incoming.message.providerMessageId,
				);
			}
		}
	};
	const schedule = () => {
		if (closed) return;
		timer = setTimeout(() => {
			running = poll()
				.catch(
					options.onError ??
						((error) => console.error("[mail] poll failed", error)),
				)
				.finally(schedule);
		}, intervalMs);
		timer.unref();
	};

	return {
		async start() {
			if (running || timer) return;
			closed = false;
			running = poll().finally(() => {
				running = undefined;
				schedule();
			});
			await running;
		},
		async close() {
			closed = true;
			if (timer) clearTimeout(timer);
			timer = undefined;
			await running;
		},
	};
}

export function createDatabaseMailboxPoller(
	database: typeof defaultDb,
	provider: MailboxProvider,
	attachmentStore?: AttachmentStore,
): MailboxPoller {
	return createMailboxPoller({
		provider,
		listMailboxes: () =>
			database
				.select({ id: mailboxes.id, ticketOrigin: mailboxes.ticketOrigin })
				.from(mailboxes)
				.where(eq(mailboxes.enabled, true)),
		process: (message) =>
			processReceivedEmail(database, message, attachmentStore),
	});
}
