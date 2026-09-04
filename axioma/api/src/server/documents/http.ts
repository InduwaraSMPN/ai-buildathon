import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { ORPCError } from "@orpc/server";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { db } from "@/db";
import { documentLinks, documents } from "@/db/schema";
import { type Context, createContext } from "../context";
import {
	canReadDocument,
	type DocumentTarget,
	type DocumentViewer,
	prepareFileDocument,
} from ".";
import { canReadTarget, requireDocumentWriteTarget } from "./access";
import { FileBlobStore, MAX_DOCUMENT_BYTES } from "./storage";

const storage = new FileBlobStore(
	process.env.AXIOMA_DOCUMENT_DIR ?? join(process.cwd(), ".data", "documents"),
);

const viewer = (context: Context): DocumentViewer => ({
	userId: context.userId as string,
	role: context.capabilities.has("ticket.read.all") ? "analyst" : "reporter",
});

async function uploadDocument(
	target: DocumentTarget,
	file: File,
	subject: DocumentViewer,
) {
	await requireDocumentWriteTarget(target, subject);
	const content = new Uint8Array(await file.arrayBuffer());
	if (content.byteLength > MAX_DOCUMENT_BYTES)
		throw new ORPCError("PAYLOAD_TOO_LARGE");
	const prepared = (() => {
		try {
			return prepareFileDocument(file.name, content);
		} catch (error) {
			throw new ORPCError("BAD_REQUEST", {
				message: error instanceof Error ? error.message : "Invalid document",
			});
		}
	})();
	const id = randomUUID();
	let wroteBlob = false;
	try {
		return await db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${prepared.sha256}))`,
			);
			const [inserted] = await tx
				.insert(documents)
				.values({
					id,
					kind: "file",
					displayName: prepared.displayName,
					mediaType: file.type || "application/octet-stream",
					sha256: prepared.sha256,
					storedFilename: prepared.storedFilename,
				})
				.onConflictDoNothing({ target: documents.sha256 })
				.returning();
			const document =
				inserted ??
				(
					await tx
						.select()
						.from(documents)
						.where(eq(documents.sha256, prepared.sha256))
						.limit(1)
				)[0];
			if (!document) throw new ORPCError("INTERNAL_SERVER_ERROR");
			wroteBlob = await storage.put(prepared.storageKey, content);
			await tx
				.insert(documentLinks)
				.values({
					id: randomUUID(),
					documentId: document.id,
					...target,
				})
				.onConflictDoNothing();
			return document;
		});
	} catch (error) {
		if (wroteBlob)
			await db.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtext(${prepared.sha256}))`,
				);
				const [committed] = await tx
					.select({ id: documents.id })
					.from(documents)
					.where(eq(documents.sha256, prepared.sha256))
					.limit(1);
				if (!committed) await storage.remove(prepared.storageKey);
			});
		throw error;
	}
}

async function readableDocument(id: string, subject: DocumentViewer) {
	const [document, links] = await Promise.all([
		db.select().from(documents).where(eq(documents.id, id)).limit(1),
		db
			.select({
				targetType: documentLinks.targetType,
				targetId: documentLinks.targetId,
			})
			.from(documentLinks)
			.where(eq(documentLinks.documentId, id)),
	]);
	const item = document[0];
	if (!item || !(await canReadDocument(links, subject, canReadTarget)))
		throw new ORPCError("NOT_FOUND");
	return item;
}

const errorResponse = (error: unknown) => {
	if (error instanceof ORPCError) {
		if (error.code === "NOT_FOUND")
			return new Response("Not Found", { status: 404 });
		if (error.code === "PAYLOAD_TOO_LARGE")
			return new Response("Payload Too Large", { status: 413 });
		if (error.code === "BAD_REQUEST")
			return new Response(error.message, { status: 400 });
	}
	throw error;
};

export const documentHttp = new Hono();
documentHttp.use(
	"/documents",
	bodyLimit({
		maxSize: MAX_DOCUMENT_BYTES + 64 * 1024,
		onError: (c) => c.text("Payload Too Large", 413),
	}),
);
documentHttp.post("/documents", async (c) => {
	try {
		const context = await createContext({ context: c });
		if (!context.userId) return c.text("Unauthorized", 401);
		const body = await c.req.parseBody();
		const targetType = (body.targetType as string | undefined) ?? "";
		const required = targetType === "draft" ? "ticket.create" : "ticket.update";
		if (!context.capabilities.has(required)) return c.text("Forbidden", 403);
		const file = body.file;
		const targetId = body.targetId;
		if (
			!(file instanceof File) ||
			(targetType !== "ticket" &&
				targetType !== "case_note" &&
				targetType !== "draft") ||
			typeof targetId !== "string" ||
			!targetId
		)
			return c.text("file, targetType, and targetId are required", 400);
		const document = await uploadDocument(
			{ targetType, targetId },
			file,
			viewer(context),
		);
		return c.json(
			{
				id: document.id,
				kind: "file",
				displayName: document.displayName,
				mediaType: document.mediaType,
				downloadUrl: `/api/documents/${document.id}`,
			},
			201,
		);
	} catch (error) {
		return errorResponse(error);
	}
});

documentHttp.get("/documents/:id", async (c) => {
	try {
		const context = await createContext({ context: c });
		if (!context.userId) return c.text("Unauthorized", 401);
		const document = await readableDocument(c.req.param("id"), viewer(context));
		if (document.kind !== "file" || !document.sha256)
			return c.text("Not Found", 404);
		const fallback = document.displayName.replaceAll(/[\r\n"\\]/g, "_");
		const encoded = encodeURIComponent(document.displayName);
		return new Response(storage.stream(document.sha256), {
			headers: {
				"Content-Type": document.mediaType ?? "application/octet-stream",
				"Content-Disposition": `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch (error) {
		return errorResponse(error);
	}
});
