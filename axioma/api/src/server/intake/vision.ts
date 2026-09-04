import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { documentLinks, documents } from "@/db/schema";
import { documentStore } from "../documents/storage";

export const IMAGE_MEDIA_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
] as const;
export const MAX_DRAFT_IMAGES = 3;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// The per-file read opt-out — the employee's choice not to have a particular
// screenshot looked at — is applied by the router, which filters the linked
// documents on `documents.id`, the identifier `excludedAttachments` carries.
// This function only sees blobs that are already cleared to be read.
export async function readDraftImages(
	images: {
		sha256: string;
		mediaType: string | null;
		size?: number | null;
	}[],
): Promise<unknown[]> {
	const eligible = images.filter(
		(image) =>
			image.sha256 &&
			image.mediaType !== null &&
			(image.size == null || image.size <= MAX_IMAGE_BYTES) &&
			(IMAGE_MEDIA_TYPES as readonly string[]).includes(image.mediaType),
	);
	if (!eligible.length) return [];

	const store = documentStore();
	const parts: unknown[] = [];
	// `documents` has no size column, so the byte cap is applied from the blob's
	// own stat rather than by reading it — an oversized screenshot is rejected
	// without ever entering memory. Capping the count first let oversized
	// attachments starve out a valid one behind them, so the count is capped on
	// what survives.
	for (const image of eligible) {
		if (parts.length >= MAX_DRAFT_IMAGES) break;
		try {
			const bytes = await store.size(image.sha256);
			if (bytes === null || bytes > MAX_IMAGE_BYTES) continue;
			const content = await store.read(image.sha256);
			if (content.byteLength > MAX_IMAGE_BYTES) continue;
			parts.push({
				type: "image_url",
				image_url: {
					url: `data:${image.mediaType};base64,${content.toString("base64")}`,
				},
			});
		} catch {
			// A missing or corrupt blob is skipped; it is not authoritative evidence.
		}
	}
	return parts;
}

/** Drops these drafts' document links, then any document nothing else references. */
export async function removeOrphanedIntakeBlobs(
	draftIds: ReadonlyArray<string>,
): Promise<void> {
	if (!draftIds.length) return;
	const targets = [...draftIds];
	const draftLinks = and(
		eq(documentLinks.targetType, "draft"),
		inArray(documentLinks.targetId, targets),
	);
	const orphans = await db.transaction(async (tx) => {
		const candidates = await tx
			.selectDistinct({ documentId: documentLinks.documentId })
			.from(documentLinks)
			.where(draftLinks);
		if (!candidates.length) return [];
		const documentIds = candidates.map((candidate) => candidate.documentId);
		// `uploadDocument` takes this same lock before inserting its link, so
		// holding it here is what stops an upload landing between the orphan
		// check and the cascade that would delete its brand-new link. Locking in
		// sha256 order keeps two concurrent sweeps from deadlocking.
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtext(${documents.sha256})) from ${documents} where ${inArray(documents.id, documentIds)} and ${documents.sha256} is not null order by ${documents.sha256}`,
		);
		await tx.delete(documentLinks).where(draftLinks);
		return tx
			.delete(documents)
			.where(
				and(
					inArray(documents.id, documentIds),
					sql`not exists (select 1 from ${documentLinks} where ${documentLinks.documentId} = ${documents.id})`,
				),
			)
			.returning({ sha256: documents.sha256 });
	});

	// Blob removal is not transactional, so it only runs once the row deletions
	// have committed.
	const store = documentStore();
	for (const orphan of orphans)
		if (orphan.sha256) await store.remove(orphan.sha256);
}
