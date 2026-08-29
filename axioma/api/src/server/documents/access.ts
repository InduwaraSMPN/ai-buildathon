import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentLinks, documents, ticketMessages, tickets } from "@/db/schema";
import { canReadCaseNote, type DocumentTarget, type DocumentViewer } from ".";

export async function canReadTarget(
	target: DocumentTarget,
	subject: DocumentViewer,
) {
	if (target.targetType === "ticket") {
		const [ticket] = await db
			.select({ reporterId: tickets.reporterId })
			.from(tickets)
			.where(eq(tickets.id, target.targetId))
			.limit(1);
		return Boolean(
			ticket &&
				(subject.role === "analyst" || ticket.reporterId === subject.userId),
		);
	}
	const [note] = await db
		.select({
			reporterId: tickets.reporterId,
			visibility: ticketMessages.visibility,
		})
		.from(ticketMessages)
		.innerJoin(tickets, eq(ticketMessages.ticketId, tickets.id))
		.where(eq(ticketMessages.id, target.targetId))
		.limit(1);
	return Boolean(
		note &&
			canReadCaseNote(subject, {
				reporterId: note.reporterId,
				private: note.visibility === "private",
			}),
	);
}

export async function requireDocumentTarget(
	target: DocumentTarget,
	subject: DocumentViewer,
) {
	if (!(await canReadTarget(target, subject))) throw new ORPCError("NOT_FOUND");
}

export async function listVisibleDocuments(
	target: DocumentTarget,
	subject: DocumentViewer,
) {
	await requireDocumentTarget(target, subject);
	return db
		.select({ document: documents })
		.from(documentLinks)
		.innerJoin(documents, eq(documentLinks.documentId, documents.id))
		.where(
			and(
				eq(documentLinks.targetType, target.targetType),
				eq(documentLinks.targetId, target.targetId),
			),
		);
}

export async function requireDocumentWriteTarget(
	target: DocumentTarget,
	subject: DocumentViewer,
) {
	if (target.targetType === "case_note" && subject.role !== "analyst")
		throw new ORPCError("NOT_FOUND");
	await requireDocumentTarget(target, subject);
}
