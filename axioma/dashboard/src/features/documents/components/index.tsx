import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Link as LinkIcon, Paperclip } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageState } from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api-url";
import { orpc } from "@/utils/orpc";

export type RequestAttachment = {
	id: string;
	name: string;
	href: string;
	kind: "file" | "link";
};

export function TicketAttachments({
	targetType = "ticket",
	targetId,
	canEdit = true,
}: {
	targetType?: "ticket" | "case_note";
	targetId: string;
	canEdit?: boolean;
}) {
	const queryClient = useQueryClient();
	const input = { targetType, targetId };
	const documents = useQuery(orpc.listDocuments.queryOptions({ input }));
	const addLink = useMutation(
		orpc.createLinkDocument.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: orpc.listDocuments.key({ input }),
				}),
			onError: (error) => toast.error(error.message),
		}),
	);
	const [uploading, setUploading] = useState(false);
	if (documents.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading attachments"
				description="Retrieving linked documents…"
			/>
		);
	if (documents.isError)
		return (
			<PageState
				kind="error"
				title="Attachments unavailable"
				description={documents.error.message}
				onRetry={() => documents.refetch()}
			/>
		);
	return (
		<AttachmentControls
			attachments={documents.data.map((item) => ({
				id: item.id,
				name: item.displayName,
				kind: item.kind,
				href: item.kind === "link" ? item.url : apiUrl(item.downloadUrl),
			}))}
			onAddLink={
				canEdit
					? () => {
							const url = window.prompt("Link URL");
							if (!url) return;
							const displayName = window.prompt("Link name", url) ?? url;
							addLink.mutate({ ...input, url, displayName });
						}
					: undefined
			}
			onFiles={
				!canEdit || uploading
					? undefined
					: async (files) => {
							setUploading(true);
							try {
								for (const file of files) {
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
								}
								await queryClient.invalidateQueries({
									queryKey: orpc.listDocuments.key({ input }),
								});
								toast.success("Attachments uploaded");
							} catch (error) {
								toast.error(
									error instanceof Error ? error.message : "Upload failed",
								);
							} finally {
								setUploading(false);
							}
						}
			}
		/>
	);
}

export function AttachmentControls({
	attachments,
	onFiles,
	onAddLink,
}: {
	attachments: readonly RequestAttachment[];
	onFiles?: (files: FileList) => void;
	onAddLink?: () => void;
}) {
	return (
		<div className="space-y-3">
			<div className="flex gap-2">
				<label className="inline-flex">
					<span className="sr-only">Attach files</span>
					<input
						className="sr-only"
						type="file"
						multiple
						disabled={!onFiles}
						onChange={(event) => {
							if (event.target.files) onFiles?.(event.target.files);
						}}
					/>
					<span className="inline-flex h-9 items-center gap-2 border px-3 text-sm">
						<Paperclip className="size-4" />
						Attach files
					</span>
				</label>
				<Button variant="outline" disabled={!onAddLink} onClick={onAddLink}>
					<LinkIcon />
					Add link
				</Button>
			</div>
			{attachments.map((item) => (
				<a
					key={item.id}
					href={item.href}
					className="flex items-center gap-2 border p-2 text-sm hover:bg-muted"
				>
					<FileUp className="size-4" />
					<span>{item.name}</span>
				</a>
			))}
		</div>
	);
}
