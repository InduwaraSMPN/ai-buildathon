import { ORPCError } from "@orpc/server";
import { db } from "@/db";
import { documentLinks, documents } from "@/db/schema";
import { type DocumentTarget, prepareLinkDocument } from "../documents";
import {
	listVisibleDocuments,
	requireDocumentWriteTarget,
	unlinkDocumentFromTarget,
} from "../documents/access";
import { anyCapabilityProcedure, capabilityProcedure } from "../orpc";

/**
 * A draft belongs to whoever is composing a request, so the capability that
 * governs it is `ticket.create` — the same one `documents/http.ts` uses for a
 * draft upload. Gating these procedures on `ticket.update` alone would make a
 * `ticket.create`-scoped caller able to upload a draft attachment but not
 * remove it. The route therefore admits either capability and the real one is
 * asserted here, per target type, so a `ticket.create` key still cannot touch a
 * ticket's or a case note's attachments.
 */
const requireWriteCapability = (
	target: DocumentTarget,
	capabilities: ReadonlySet<string>,
) => {
	const required =
		target.targetType === "draft" ? "ticket.create" : "ticket.update";
	if (!capabilities.has(required)) throw new ORPCError("FORBIDDEN");
};

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
	createLinkDocument: anyCapabilityProcedure(
		"ticket.update",
		"ticket.create",
	).createLinkDocument.handler(async ({ context, input }) => {
		requireWriteCapability(input, context.capabilities);
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
	unlinkDocument: anyCapabilityProcedure(
		"ticket.update",
		"ticket.create",
	).unlinkDocument.handler(async ({ context, input }) => {
		requireWriteCapability(input, context.capabilities);
		await requireDocumentWriteTarget(input, {
			userId: context.userId,
			role: context.capabilities.has("ticket.read.all")
				? "analyst"
				: "reporter",
		});
		return unlinkDocumentFromTarget(input.documentId, input);
	}),
};
