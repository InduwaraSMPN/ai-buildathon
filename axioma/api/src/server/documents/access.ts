import { ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	documentLinks,
	documents,
	ticketDrafts,
	ticketMessages,
	tickets,
} from "@/db/schema";
import { canReadCaseNote, type DocumentTarget, type DocumentViewer } from ".";
import { documentStore } from "./storage";

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
	if (target.targetType === "draft") {
		const [draft] = await db
			.select({
				reporterId: ticketDrafts.reporterId,
				status: ticketDrafts.status,
			})
			.from(ticketDrafts)
			.where(eq(ticketDrafts.id, target.targetId))
			.limit(1);
		return Boolean(
			draft && draft.status === "open" && draft.reporterId === subject.userId,
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

/**
 * Drops one document's link to one target and, when nothing else references the
 * document, the document row and its blob with it. Deleting only the link left
 * the bytes on disk forever, which for an intake draft means a screenshot the
 * employee explicitly removed was still readable. The advisory lock and the
 * post-commit blob removal mirror `removeOrphanedIntakeBlobs`, so an upload
 * cannot land between the orphan check and the delete.
 */
export async function unlinkDocumentFromTarget(
	documentId: string,
	target: DocumentTarget,
): Promise<{ deleted: boolean }> {
	const orphans = await db.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtext(${documents.sha256})) from ${documents} where ${eq(documents.id, documentId)} and ${documents.sha256} is not null`,
		);
		const removed = await tx
			.delete(documentLinks)
			.where(
				and(
					eq(documentLinks.documentId, documentId),
					eq(documentLinks.targetType, target.targetType),
					eq(documentLinks.targetId, target.targetId),
				),
			)
			.returning({ id: documentLinks.id });
		if (!removed[0]) return null;
		return tx
			.delete(documents)
			.where(
				and(
					eq(documents.id, documentId),
					sql`not exists (select 1 from ${documentLinks} where ${documentLinks.documentId} = ${documents.id})`,
				),
			)
			.returning({ sha256: documents.sha256 });
	});
	if (!orphans) return { deleted: false };
	const store = documentStore();
	for (const orphan of orphans)
		if (orphan.sha256) await store.remove(orphan.sha256);
	return { deleted: true };
}

export async function requireDocumentWriteTarget(
	target: DocumentTarget,
	subject: DocumentViewer,
) {
	if (target.targetType === "case_note" && subject.role !== "analyst")
		throw new ORPCError("NOT_FOUND");
	// A draft needs no extra write rule: `canReadTarget` already restricts it to
	// the owning reporter while the draft is still open, and that is exactly who
	// may attach to it. An earlier `role !== "reporter"` guard here locked out
	// analysts filing their own requests, because `role` is derived from
	// `ticket.read.all` and IT staff hold both that and `ticket.create`.
	await requireDocumentTarget(target, subject);
}
