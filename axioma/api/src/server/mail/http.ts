import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "@/db";
import { mailboxes } from "@/db/schema";
import { env } from "@/env";
import { processReceivedEmail } from "./db";

const inbound = z.object({
	mailboxId: z.string().min(1),
	providerMessageId: z.string().min(1),
	from: z.email(),
	to: z.email(),
	subject: z.string().max(998).default("(no subject)"),
	text: z.string().max(1_000_000).optional(),
	headers: z.record(z.string(), z.string()).default({}),
	receivedAt: z.coerce.date().default(() => new Date()),
});

export const mailHttp = new Hono();

mailHttp.post("/mail/inbound", async (c) => {
	if (!env.AXIOMA_MAIL_INBOUND_TOKEN)
		return c.json({ error: "Not configured" }, 404);
	if (
		c.req.header("authorization") !== `Bearer ${env.AXIOMA_MAIL_INBOUND_TOKEN}`
	)
		return c.json({ error: "Unauthorized" }, 401);
	const parsed = inbound.safeParse(await c.req.json().catch(() => undefined));
	if (!parsed.success) return c.json({ error: "Invalid mail payload" }, 400);
	const { mailboxId, receivedAt, ...message } = parsed.data;
	const [mailbox] = await db
		.select({ id: mailboxes.id, ticketOrigin: mailboxes.ticketOrigin })
		.from(mailboxes)
		.where(eq(mailboxes.id, mailboxId))
		.limit(1);
	if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);
	const ticketId = await processReceivedEmail(db, {
		mailbox,
		message,
		receivedAt,
	});
	return c.json({ accepted: true, ticketId: ticketId ?? null });
});
