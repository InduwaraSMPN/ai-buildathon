import { RiCloseLine, RiFileLine, RiImage2Line } from "@remixicon/react";
import type { Dispatch, SetStateAction } from "react";
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
import { unlinkDraftDocument } from "@/features/intake/api/mutations";
import { intakeCopy } from "@/features/intake/copy";
import { forgetReadFlag } from "@/features/intake/state/draft-session";
import type { DraftAttachment } from "@/features/intake/types";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const MAX_IMAGE_COUNT = 3;
const MAX_FILE_SIZE = 2 * 1024 * 1024;

function extensionOf(name: string): string {
	return name.split(".").pop()?.toLowerCase() ?? "";
}

/** A dropped file can arrive with an empty media type, so the name is the fallback. */
function isAllowedImage(file: File): boolean {
	return file.type
		? ALLOWED_IMAGE_TYPES.has(file.type)
		: ALLOWED_EXTENSIONS.has(extensionOf(file.name));
}

function mediaKind(file: File): "image" | "file" {
	return file.type.startsWith("image/") ||
		ALLOWED_EXTENSIONS.has(extensionOf(file.name))
		? "image"
		: "file";
}

export function AttachmentTray({
	draftId,
	disabled,
	visionEnabled,
	attachments,
	onAttachmentsChange,
}: {
	draftId: string;
	disabled: boolean;
	visionEnabled: boolean;
	attachments: DraftAttachment[];
	onAttachmentsChange: Dispatch<SetStateAction<DraftAttachment[]>>;
}) {
	const [uploading, setUploading] = useState(false);
	const [removing, setRemoving] = useState<string[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFiles = async (files: FileList | File[]) => {
		const valid: File[] = [];
		for (const file of Array.from(files)) {
			if (!isAllowedImage(file)) {
				toast.error(intakeCopy.attachmentTypeRejected(file.name));
				continue;
			}
			if (file.size > MAX_FILE_SIZE) {
				toast.error(intakeCopy.attachmentTooLarge(file.name));
				continue;
			}
			valid.push(file);
		}
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
			const results = await uploadDocuments({
				targetType: "draft",
				targetId: draftId,
				files: accepted,
			});
			// Settled by key, not by status: a second batch started while this one
			// was still in flight used to erase the first batch's rows.
			const settled = new Map(
				batch.map((entry, index) => [
					entry.key,
					{
						...entry,
						id: results[index]?.id ?? "",
						status: results[index] ? ("done" as const) : ("error" as const),
					},
				]),
			);
			onAttachmentsChange((prev) =>
				prev.map((entry) => settled.get(entry.key) ?? entry),
			);
		} catch {
			// uploadDocuments already toasts the failure.
			const failed = new Set(batch.map((entry) => entry.key));
			onAttachmentsChange((prev) =>
				prev.map((entry) =>
					failed.has(entry.key)
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
		if (!target.id) {
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

	return (
		<div className="flex min-w-0 flex-col gap-2">
			{attachments.length > 0 ? (
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
			) : null}

			<input
				ref={inputRef}
				className="sr-only"
				type="file"
				multiple
				accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
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
		</div>
	);
}
