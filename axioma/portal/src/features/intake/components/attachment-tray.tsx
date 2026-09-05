import { RiCloseLine, RiFileLine, RiImage2Line } from "@remixicon/react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
	Attachment,
	AttachmentAction,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentGroup,
	AttachmentMedia,
	AttachmentTitle,
} from "@/components/ui/attachment";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
	PromptInputAttachments,
	PromptInputUpload,
} from "@/components/ui/prompt-input";
import { uploadDocuments } from "@/features/documents/api";
import {
	ATTACHMENT_ACCEPT,
	mediaKind,
	screenAttachments,
} from "@/features/documents/attachments";
import { unlinkDraftDocument } from "@/features/intake/api/mutations";
import { intakeCopy } from "@/features/intake/copy";
import {
	forgetReadFlag,
	readSavedReadFlags,
} from "@/features/intake/state/draft-session";
import type { DraftAttachment } from "@/features/intake/types";
import { orpc, queryClient } from "@/utils/orpc";

const MAX_IMAGE_COUNT = 3;

export function useAttachmentTray({
	draftId,
	disabled,
	visionEnabled,
	attachments,
	onAttachmentsChange,
}: {
	draftId: string | null;
	disabled: boolean;
	visionEnabled: boolean;
	attachments: DraftAttachment[];
	onAttachmentsChange: Dispatch<SetStateAction<DraftAttachment[]>>;
}): { list: ReactNode; upload: ReactNode } {
	const [uploading, setUploading] = useState(false);
	const [removing, setRemoving] = useState<string[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);

	/**
	 * Rebuilds the tray from the server's own list of what is linked to the
	 * draft. After a partial failure the tray is the least reliable account of
	 * that: a file whose response never arrived may well be stored, and one
	 * marked `error` may not exist at all. `submitIntakeDraft` re-parents every
	 * document still linked, so anything the server holds has to be on screen
	 * where the employee can take it back off.
	 */
	const reconcile = async () => {
		if (!draftId) return;
		const target = { targetType: "draft" as const, targetId: draftId };
		const documents = await orpc.listDocuments.call(target);
		const flags = readSavedReadFlags(draftId);
		onAttachmentsChange((prev) => {
			const linked = new Map(documents.map((item) => [item.id, item]));
			// A row still uploading belongs to a later batch the server has not
			// been told about yet, so it survives untouched.
			const kept = prev
				.filter((entry) => entry.status === "uploading" || linked.has(entry.id))
				.map((entry) =>
					entry.status === "uploading"
						? entry
						: { ...entry, status: "done" as const },
				);
			const seen = new Set(kept.map((entry) => entry.id));
			return [
				...kept,
				// A document with no stored choice is opted OUT of vision, so a row
				// recovered here never re-enables reading on its own.
				...documents
					.filter((item) => !seen.has(item.id))
					.map((item) => ({
						key: item.id,
						id: item.id,
						name: item.displayName,
						kind:
							item.kind === "file" &&
							(item.mediaType?.startsWith("image/") ?? false)
								? ("image" as const)
								: ("file" as const),
						status: "done" as const,
						read: flags[item.id] === true,
					})),
			];
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.listDocuments.key({ input: target }),
		});
	};

	const handleFiles = async (files: FileList | File[]) => {
		if (!draftId) return;
		const { accepted: valid, rejected } = screenAttachments(files);
		for (const entry of rejected)
			toast.error(
				entry.reason === "type"
					? intakeCopy.attachmentTypeRejected(entry.file.name)
					: intakeCopy.attachmentTooLarge(entry.file.name),
			);
		if (valid.length === 0) return;

		const room = Math.max(
			0,
			MAX_IMAGE_COUNT -
				attachments.filter((entry) => entry.kind === "image").length,
		);
		if (valid.length > room)
			toast.error(intakeCopy.attachmentTooMany(MAX_IMAGE_COUNT));
		const accepted = valid.slice(0, room);
		if (accepted.length === 0) return;

		const batch = accepted.map((file, index) => ({
			key: `${file.name}-${Date.now()}-${index}`,
			id: "",
			name: file.name,
			kind: mediaKind(file),
			status: "uploading" as const,
			read: mediaKind(file) === "image",
		}));

		onAttachmentsChange((prev) => [...prev, ...batch]);
		setUploading(true);
		try {
			const outcomes = await uploadDocuments({
				targetType: "draft",
				targetId: draftId,
				files: accepted,
			});
			// Settled by key, not by status: a second batch started while this one
			// was still in flight used to erase the first batch's rows.
			const settled = new Map(
				batch.map((entry, index) => {
					const outcome = outcomes[index];
					return [
						entry.key,
						outcome?.status === "uploaded"
							? { ...entry, id: outcome.document.id, status: "done" as const }
							: { ...entry, id: "", status: "error" as const },
					];
				}),
			);
			onAttachmentsChange((prev) =>
				prev.map((entry) => settled.get(entry.key) ?? entry),
			);
			if (outcomes.some((outcome) => outcome.status === "failed"))
				await reconcile();
		} catch {
			// uploadDocuments already toasts the failure; only a failure of the
			// reconcile itself reaches here, and it leaves the rows as they are
			// rather than guessing at what the server kept.
			const failed = new Set(batch.map((entry) => entry.key));
			onAttachmentsChange((prev) =>
				prev.map((entry) =>
					failed.has(entry.key) && entry.status === "uploading"
						? { ...entry, status: "error" as const }
						: entry,
				),
			);
		} finally {
			setUploading(false);
		}
	};

	const drop = (key: string) =>
		onAttachmentsChange((prev) => prev.filter((entry) => entry.key !== key));

	/**
	 * The row disappears only once the server confirms the unlink.
	 * `submitIntakeDraft` re-parents every document still linked to the draft, so
	 * dropping the row optimistically would leave the employee believing a
	 * screenshot was gone while it was still on its way onto the ticket. A failed
	 * unlink therefore keeps the attachment on screen and says so.
	 */
	const remove = async (target: DraftAttachment) => {
		// Nothing reached the server, so there is no link to drop.
		if (!target.id || !draftId) {
			drop(target.key);
			return;
		}
		setRemoving((prev) => [...prev, target.key]);
		try {
			await unlinkDraftDocument(draftId, target.id);
			forgetReadFlag(draftId, target.id);
			drop(target.key);
		} catch {
			toast.error(intakeCopy.removeAttachmentFailed(target.name));
		} finally {
			setRemoving((prev) => prev.filter((key) => key !== target.key));
		}
	};

	const toggleRead = (key: string, checked: boolean) =>
		onAttachmentsChange((prev) =>
			prev.map((entry) =>
				entry.key === key ? { ...entry, read: checked } : entry,
			),
		);

	const list =
		attachments.length > 0 ? (
			<PromptInputAttachments>
				<AttachmentGroup>
					{attachments.map((entry) => {
						const isRemoving = removing.includes(entry.key);
						const uploadLabel =
							entry.status === "uploading"
								? intakeCopy.attachmentUploading
								: null;
						const description = isRemoving
							? intakeCopy.attachmentRemoving
							: uploadLabel;
						return (
							<div key={entry.key} className="flex flex-col gap-1">
								<Attachment state={entry.status} size="sm">
									<AttachmentMedia variant="icon">
										{entry.kind === "image" ? (
											<RiImage2Line aria-hidden="true" />
										) : (
											<RiFileLine aria-hidden="true" />
										)}
									</AttachmentMedia>
									<AttachmentContent>
										<AttachmentTitle>{entry.name}</AttachmentTitle>
										{description ? (
											<AttachmentDescription>
												{description}
											</AttachmentDescription>
										) : null}
									</AttachmentContent>
									<AttachmentActions>
										<AttachmentAction
											aria-label={`${intakeCopy.removeAttachment}: ${entry.name}`}
											disabled={isRemoving}
											onClick={() => void remove(entry)}
										>
											<RiCloseLine aria-hidden="true" />
										</AttachmentAction>
									</AttachmentActions>
								</Attachment>
								{visionEnabled && entry.kind === "image" ? (
									<Label className="flex items-center gap-2 font-normal text-xs">
										<Checkbox
											checked={entry.read}
											disabled={isRemoving}
											onCheckedChange={(checked) =>
												toggleRead(entry.key, checked === true)
											}
										/>
										<span>{intakeCopy.readScreenshotsLabel}</span>
									</Label>
								) : null}
							</div>
						);
					})}
				</AttachmentGroup>
			</PromptInputAttachments>
		) : null;

	const upload = (
		<>
			<input
				ref={inputRef}
				className="sr-only"
				type="file"
				multiple
				accept={ATTACHMENT_ACCEPT}
				// Visually hidden but still in the tab order, this landed a keyboard
				// user on an unnamed control immediately before the visible button
				// that opens the very same picker.
				aria-label={intakeCopy.attachFiles}
				tabIndex={-1}
				disabled={disabled || uploading || !draftId}
				onChange={(event) => {
					if (!event.target.files?.length) return;
					void handleFiles(event.target.files);
					event.target.value = "";
				}}
			/>
			<PromptInputUpload
				disabled={disabled || uploading || !draftId}
				onClick={() => inputRef.current?.click()}
			>
				{uploading ? intakeCopy.attachmentUploading : intakeCopy.attachFiles}
			</PromptInputUpload>
		</>
	);

	return { list, upload };
}
