import { db } from "@/db";
import { setNotificationMailProvider } from "../workflows/runtime";
import type { AttachmentStore } from "./db";
import {
	createDatabaseMailboxPoller,
	type MailboxPoller,
	type MailboxProvider,
} from "./poller";
import type { MailProvider } from "./send";

let mailboxProvider: MailboxProvider | undefined;
let attachmentStore: AttachmentStore | undefined;
let poller: MailboxPoller | undefined;

/** Call from a deployment bootstrap before importing index.ts. */
export function configureMailRuntime(options: {
	inbound?: MailboxProvider;
	outbound?: MailProvider;
	attachments?: AttachmentStore;
}) {
	mailboxProvider = options.inbound;
	attachmentStore = options.attachments;
	setNotificationMailProvider(options.outbound);
}

export async function startMailRuntime() {
	if (!mailboxProvider || poller) return;
	poller = createDatabaseMailboxPoller(db, mailboxProvider, attachmentStore);
	await poller.start();
}

export async function closeMailRuntime() {
	await poller?.close();
	poller = undefined;
	setNotificationMailProvider(undefined);
}
