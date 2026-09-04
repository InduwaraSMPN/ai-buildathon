import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { AxiomaMark } from "@/components/brand";
import {
	PromptInput,
	PromptInputBody,
	PromptInputMic,
	PromptInputSubmit,
	PromptInputToolbar,
} from "@/components/ui/prompt-input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAttachmentTray } from "@/features/intake/components/attachment-tray";
import { intakeCopy } from "@/features/intake/copy";
import type { DraftAttachment } from "@/features/intake/types";

export function IntakeComposer({
	draftId,
	streaming,
	visionEnabled,
	attachments,
	onAttachmentsChange,
	onSubmit,
	onManual,
}: {
	draftId: string | null;
	streaming: boolean;
	visionEnabled: boolean;
	attachments: DraftAttachment[];
	onAttachmentsChange: Dispatch<SetStateAction<DraftAttachment[]>>;
	/** Returns whether the message was accepted; a refused one stays in the box. */
	onSubmit: (text: string) => boolean;
	onManual: () => void;
}) {
	const [text, setText] = useState("");

	// The draft id is what the handler needs to send anything, so a composer
	// without one is busy in exactly the way a streaming one is. Leaving it live
	// meant the first message — typed before `startIntakeDraft` resolved — was
	// refused by the handler and then cleared from the box anyway.
	const busy = streaming || draftId === null;

	const canSubmit =
		text.trim().length > 0 && text.trim().length <= 10_000 && !busy;

	const submit = () => {
		if (!canSubmit) return;
		if (onSubmit(text.trim())) setText("");
	};

	const tray = useAttachmentTray({
		draftId,
		disabled: busy,
		visionEnabled,
		attachments,
		onAttachmentsChange,
	});

	return (
		<TooltipProvider>
			<div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-7 py-6 sm:py-10">
				<div className="relative shrink-0" aria-hidden="true">
					<AxiomaMark className="absolute inset-0 size-16 text-primary opacity-60 blur-md" />
					<AxiomaMark className="relative size-16 text-primary" />
				</div>

				<div className="flex flex-col items-center gap-2 text-center">
					<h1 className="text-balance bg-linear-to-r from-primary to-primary/70 bg-clip-text font-semibold text-3xl text-transparent tracking-tight">
						{intakeCopy.composerTitle}
					</h1>
				</div>

				<PromptInput className="max-w-none">
					<PromptInputBody
						rows={3}
						value={text}
						placeholder={intakeCopy.composerPlaceholder}
						disabled={busy}
						onChange={(event) => setText(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								submit();
							}
						}}
					/>

					{tray.list}

					<PromptInputToolbar>
						{tray.upload}
						<div className="flex items-center gap-1">
							<PromptInputMic />
							<PromptInputSubmit
								busy={busy}
								disabled={!canSubmit}
								onClick={submit}
							/>
						</div>
					</PromptInputToolbar>
				</PromptInput>

				<div className="flex flex-col items-center gap-2 text-center text-xs">
					<button
						type="button"
						className="text-primary underline underline-offset-4"
						onClick={onManual}
					>
						{intakeCopy.manualEscape}
					</button>
				</div>
			</div>
		</TooltipProvider>
	);
}
