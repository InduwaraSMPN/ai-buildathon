import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { AxiomaMark } from "@/components/brand";
import {
	PromptInput,
	PromptInputBody,
	PromptInputMic,
	PromptInputSubmit,
	PromptInputSuggestion,
	PromptInputSuggestionChip,
	PromptInputToolbar,
} from "@/components/ui/prompt-input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAttachmentTray } from "@/features/intake/components/attachment-tray";
import { intakeCopy } from "@/features/intake/copy";
import type { DraftAttachment } from "@/features/intake/types";
import { cn } from "@/lib/utils";

export function IntakeComposer({
	draftId,
	streaming,
	visionEnabled,
	attachments,
	onAttachmentsChange,
	onSubmit,
	onManual,
	/**
	 * `hero` is the empty first screen and owns the page's only h1. `docked`
	 * sits under a transcript that already says what this is, so it drops the
	 * mark, the headline and the escape link rather than repeating all three
	 * inside a chat footer.
	 */
	variant = "hero",
}: {
	draftId: string | null;
	streaming: boolean;
	visionEnabled: boolean;
	attachments: DraftAttachment[];
	onAttachmentsChange: Dispatch<SetStateAction<DraftAttachment[]>>;
	/** Returns whether the message was accepted; a refused one stays in the box. */
	onSubmit: (text: string) => boolean;
	onManual: () => void;
	variant?: "hero" | "docked";
}) {
	const [text, setText] = useState("");
	const hero = variant === "hero";

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

	const input = (
		<PromptInput
			className={cn(
				"max-w-none",
				// Docked, the panel footer supplies the inset, so the input stops
				// adding a second one under the toolbar row.
				!hero && "gap-1 rounded-xl p-1.5 shadow-none",
			)}
		>
			<PromptInputBody
				rows={hero ? 3 : 2}
				value={text}
				placeholder={intakeCopy.composerPlaceholder}
				disabled={busy}
				className={cn(!hero && "min-h-16")}
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
	);

	if (!hero) return <TooltipProvider>{input}</TooltipProvider>;

	return (
		<TooltipProvider>
			<div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6 sm:py-10">
				<div className="flex flex-col gap-3">
					<AxiomaMark
						className="size-10 text-primary sm:size-11"
						aria-hidden="true"
					/>
					<h1 className="text-balance font-heading font-semibold text-3xl tracking-tight sm:text-4xl">
						{intakeCopy.composerTitle}
					</h1>
					{/* One promise, once. The review screen carries its own line, so
					    this one is not repeated there. */}
					<p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
						{intakeCopy.composerDescription}
					</p>
				</div>

				{input}

				{/* Openers, not shortcuts: a chip fills the box and leaves the
				    sending to the employee, so nothing is sent that they have not
				    read. */}
				<PromptInputSuggestion className="justify-start">
					{intakeCopy.composerExamples.map((example) => (
						<PromptInputSuggestionChip
							key={example}
							disabled={busy}
							className="text-muted-foreground text-sm hover:text-foreground"
							onClick={() => setText(example)}
						>
							{example}
						</PromptInputSuggestionChip>
					))}
				</PromptInputSuggestion>

				<button
					type="button"
					className="self-start text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
					onClick={onManual}
				>
					{intakeCopy.manualEscape}
				</button>
			</div>
		</TooltipProvider>
	);
}
