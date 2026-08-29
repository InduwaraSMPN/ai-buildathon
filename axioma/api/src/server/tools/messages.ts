import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { ticketMessages } from "@/db/schema/messages";

export const ticketReadMessagesInput = z.object({
	ticket_id: z.string().trim().min(1),
});

export async function ticketReadMessages(
	input: z.infer<typeof ticketReadMessagesInput>,
) {
	return db
		.select({
			id: ticketMessages.id,
			ticketId: ticketMessages.ticketId,
			authorId: ticketMessages.authorId,
			authorType: ticketMessages.authorType,
			body: ticketMessages.body,
			createdAt: ticketMessages.createdAt,
		})
		.from(ticketMessages)
		.where(
			and(
				eq(ticketMessages.ticketId, input.ticket_id),
				eq(ticketMessages.visibility, "public"),
			),
		)
		.orderBy(asc(ticketMessages.createdAt), asc(ticketMessages.id));
}
