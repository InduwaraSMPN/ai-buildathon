import {
	RiUpload2Line as FileUp,
	RiLink as LinkIcon,
	RiAttachment2 as Paperclip,
} from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageState } from "@/components/support-ui";
import {
	Attachment,
	AttachmentContent,
	AttachmentDescription,
	AttachmentGroup,
	AttachmentMedia,
	AttachmentTitle,
	AttachmentTrigger,
} from "@/components/ui/attachment";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { apiUrl } from "@/lib/api-url";
import { cn } from "@/lib/utils";
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
	const [linkDialogOpen, setLinkDialogOpen] = useState(false);
	const [uploading, setUploading] = useState(false);
	const addLink = useMutation(
		orpc.createLinkDocument.mutationOptions({
			onSuccess: () => {
				setLinkDialogOpen(false);
				return queryClient.invalidateQueries({
					queryKey: orpc.listDocuments.key({ input }),
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);

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
		<>
			<AttachmentControls
				attachments={documents.data.map((item) => ({
					id: item.id,
					name: item.displayName,
					kind: item.kind,
					href: item.kind === "link" ? item.url : apiUrl(item.downloadUrl),
				}))}
				uploading={uploading}
				onAddLink={canEdit ? () => setLinkDialogOpen(true) : undefined}
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
			<Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
				<DialogContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							const data = new FormData(event.currentTarget);
							const url = String(data.get("url") ?? "").trim();
							const displayName = String(data.get("displayName") ?? "").trim();
							if (url)
								addLink.mutate({
									...input,
									url,
									displayName: displayName || url,
								});
						}}
					>
						<DialogHeader>
							<DialogTitle>Add link</DialogTitle>
							<DialogDescription>
								Attach a web resource to this{" "}
								{targetType === "ticket" ? "ticket" : "case note"}.
							</DialogDescription>
						</DialogHeader>
						<FieldGroup className="mt-4">
							<Field>
								<FieldLabel htmlFor="attachment-url">Link URL</FieldLabel>
								<Input
									id="attachment-url"
									name="url"
									type="url"
									required
									autoFocus
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="attachment-name">Link name</FieldLabel>
								<Input
									id="attachment-name"
									name="displayName"
									placeholder="Uses the URL when blank"
								/>
							</Field>
						</FieldGroup>
						<DialogFooter className="mt-4">
							<Button
								type="button"
								variant="outline"
								onClick={() => setLinkDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={addLink.isPending}>
								{addLink.isPending ? (
									<Spinner data-icon="inline-start" />
								) : (
									<LinkIcon data-icon="inline-start" />
								)}
								Add link
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}

export function AttachmentControls({
	attachments,
	onFiles,
	onAddLink,
	uploading = false,
}: {
	attachments: readonly RequestAttachment[];
	onFiles?: (files: readonly File[]) => void;
	onAddLink?: () => void;
	uploading?: boolean;
}) {
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap gap-2">
				<label
					className={cn(
						buttonVariants({ variant: "outline" }),
						!onFiles && "pointer-events-none opacity-50",
					)}
				>
					<input
						className="sr-only"
						type="file"
						multiple
						disabled={!onFiles}
						onChange={(event) => {
							// `files` is a live list that the reset below empties, so it is
							// snapshotted first — otherwise only the first file uploads.
							const files = Array.from(event.target.files ?? []);
							event.target.value = "";
							if (files.length) onFiles?.(files);
						}}
					/>
					{uploading ? (
						<Spinner data-icon="inline-start" />
					) : (
						<Paperclip data-icon="inline-start" />
					)}
					{uploading ? "Uploading…" : "Attach files"}
				</label>
				<Button variant="outline" disabled={!onAddLink} onClick={onAddLink}>
					<LinkIcon data-icon="inline-start" />
					Add link
				</Button>
			</div>
			{attachments.length ? (
				<AttachmentGroup className="flex-wrap overflow-visible">
					{attachments.map((item) => (
						<Attachment key={item.id} className="w-full sm:w-auto">
							<AttachmentMedia>
								{item.kind === "link" ? <LinkIcon /> : <FileUp />}
							</AttachmentMedia>
							<AttachmentContent>
								<AttachmentTitle>{item.name}</AttachmentTitle>
								<AttachmentDescription>
									{item.kind === "link" ? "Web link" : "File attachment"}
								</AttachmentDescription>
							</AttachmentContent>
							<AttachmentTrigger
								render={<a href={item.href} />}
								aria-label={`Open ${item.name}`}
							/>
						</Attachment>
					))}
				</AttachmentGroup>
			) : (
				<p className="text-muted-foreground text-sm">No attachments yet.</p>
			)}
		</div>
	);
}
