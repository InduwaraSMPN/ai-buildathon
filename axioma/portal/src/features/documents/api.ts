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

export async function uploadDocuments({
	targetType,
	targetId,
	files,
}: UploadDocumentsInput): Promise<UploadDocumentResult[]> {
	try {
		const uploaded = await Promise.all(
			Array.from(files, async (file) => {
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
			}),
		);
		// `listDocuments` takes `draft` too now, and the intake tray rehydrates
		// from it, so a draft upload has to invalidate the same key as any other.
		await queryClient.invalidateQueries({
			queryKey: orpc.listDocuments.key({ input: { targetType, targetId } }),
		});
		toast.success(attachmentCopy.uploaded);
		return uploaded;
	} catch (error) {
		toast.error(attachmentCopy.uploadFailed);
		throw error;
	}
}
