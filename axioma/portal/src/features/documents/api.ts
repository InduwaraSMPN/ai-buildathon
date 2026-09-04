import { toast } from "sonner";
import { attachmentCopy } from "@/features/tickets/copy";
import { apiUrl } from "@/lib/api-url";
import { orpc, queryClient } from "@/utils/orpc";

export type UploadDocumentsInput = {
	targetType: "ticket" | "case_note" | "draft";
	targetId: string;
	files: FileList | File[];
};

export type UploadDocumentResult = {
	id: string;
	kind: "file";
	displayName: string;
	mediaType: string | null;
	downloadUrl: string;
};

/** One entry per file, in the order they were given. */
export type UploadDocumentOutcome =
	| { status: "uploaded"; document: UploadDocumentResult }
	| { status: "failed" };

async function uploadOne(
	targetType: UploadDocumentsInput["targetType"],
	targetId: string,
	file: File,
): Promise<UploadDocumentResult> {
	const body = new FormData();
	body.set("file", file);
	body.set("targetType", targetType);
	body.set("targetId", targetId);
	const response = await fetch(apiUrl("api/documents"), {
		method: "POST",
		body,
		credentials: "include",
	});
	if (!response.ok) throw new Error(await response.text());
	return (await response.json()) as UploadDocumentResult;
}

/**
 * Uploads a batch and reports on each file separately.
 *
 * `Promise.all` rejected the whole batch on the first failure, so the files
 * that *had* uploaded stayed linked to the target with nothing on screen
 * admitting it — and on a draft that meant a screenshot the tray showed as
 * failed was still re-parented onto the ticket at submit. Settling per file is
 * what lets each row be resolved against what the server actually holds.
 */
export async function uploadDocuments({
	targetType,
	targetId,
	files,
}: UploadDocumentsInput): Promise<UploadDocumentOutcome[]> {
	const settled = await Promise.allSettled(
		Array.from(files, (file) => uploadOne(targetType, targetId, file)),
	);
	const outcomes = settled.map(
		(entry): UploadDocumentOutcome =>
			entry.status === "fulfilled"
				? { status: "uploaded", document: entry.value }
				: { status: "failed" },
	);
	const uploaded = outcomes.filter(
		(entry) => entry.status === "uploaded",
	).length;
	if (uploaded > 0) {
		// `listDocuments` takes `draft` too now, and the intake tray rehydrates
		// from it, so a draft upload has to invalidate the same key as any other.
		await queryClient.invalidateQueries({
			queryKey: orpc.listDocuments.key({ input: { targetType, targetId } }),
		});
		toast.success(attachmentCopy.uploaded);
	}
	if (uploaded < outcomes.length) toast.error(attachmentCopy.uploadFailed);
	return outcomes;
}
