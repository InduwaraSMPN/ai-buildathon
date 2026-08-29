import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentLinks, documents } from "@/db/schema";
import { prepareLinkDocument } from "../documents";
import {
	listVisibleDocuments,
	requireDocumentWriteTarget,
} from "../documents/http";
import { capabilityProcedure } from "../orpc";

export const documentsRouter = {
	listDocuments: capabilityProcedure("ticket.read.own").listDocuments.handler(
		async ({ context, input }) => {
			const rows = await listVisibleDocuments(input, {
				userId: context.userId,
				role: context.capabilities.has("ticket.read.all")
					? "analyst"
					: "reporter",
			});
			return rows.map(({ document: item }) =>
				item.kind === "link" && item.url
					? {
							id: item.id,
							kind: "link" as const,
							displayName: item.displayName,
							url: item.url,
						}
					: {
							id: item.id,
							kind: "file" as const,
							displayName: item.displayName,
							mediaType: item.mediaType,
							downloadUrl: `/api/documents/${item.id}`,
						},
			);
		},
	),
	createLinkDocument: capabilityProcedure(
		"ticket.update",
	).createLinkDocument.handler(async ({ context, input }) => {
		await requireDocumentWriteTarget(input, {
			userId: context.userId,
			role: context.capabilities.has("ticket.read.all")
				? "analyst"
				: "reporter",
		});
		const prepared = prepareLinkDocument(input.displayName, input.url);
		const id = crypto.randomUUID();
		await db.transaction(async (tx) => {
			await tx.insert(documents).values({ id, kind: "link", ...prepared });
			await tx.insert(documentLinks).values({
				id: crypto.randomUUID(),
				documentId: id,
				targetType: input.targetType,
				targetId: input.targetId,
			});
		});
		return { id, kind: "link" as const, ...prepared };
	}),
	unlinkDocument: capabilityProcedure("ticket.update").unlinkDocument.handler(
		async ({ context, input }) => {
			await requireDocumentWriteTarget(input, {
				userId: context.userId,
				role: context.capabilities.has("ticket.read.all")
					? "analyst"
					: "reporter",
			});
			const deleted = Boolean(
				(
					await db
						.delete(documentLinks)
						.where(
							and(
								eq(documentLinks.documentId, input.documentId),
								eq(documentLinks.targetType, input.targetType),
								eq(documentLinks.targetId, input.targetId),
							),
						)
						.returning({ id: documentLinks.id })
				)[0],
			);
			return { deleted };
		},
	),
};
