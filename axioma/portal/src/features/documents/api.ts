import { toast } from "sonner";
import { env } from "@/env";
import { attachmentCopy } from "@/features/tickets/copy";
import { orpc, queryClient } from "@/utils/orpc";

export type UploadDocumentsInput = {
	targetType: "ticket" | "case_note";
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
				const response = await fetch(
					new URL(
						"api/documents",
						`${env.VITE_SERVER_URL.replace(/\/$/, "")}/`,
					),
					{ method: "POST", body, credentials: "include" },
				);
				if (!response.ok) throw new Error(await response.text());
				return (await response.json()) as UploadDocumentResult;
			}),
		);
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
