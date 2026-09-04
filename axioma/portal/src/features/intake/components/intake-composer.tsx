import { useQuery } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
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
import { AttachmentTray } from "@/features/intake/components/attachment-tray";
import { intakeCopy } from "@/features/intake/copy";
import type { DraftAttachment } from "@/features/intake/types";
import { orpc } from "@/utils/orpc";

const SUGGESTION_COUNT = 3;

const FALLBACK_SUGGESTIONS = intakeCopy.fallbackSuggestions.map(
	(label, index) => ({ id: `fallback-${index}`, label }),
);

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
	const catalogue = useQuery(orpc.listRequestCatalogue.queryOptions());

	// The chips are seeded from the request catalogue, so the order has to be
	// defined rather than whatever the query happened to return: the
	// subcategories a request can actually be filed against first, then by name.
	// Keyed by id because two subcategories under different services may share a
	// name.
	const suggestions = useMemo(() => {
		const items = catalogue.data ?? [];
		if (!items.length) return FALLBACK_SUGGESTIONS;
		return [...items]
			.sort(
				(left, right) =>
					Number(Boolean(right.form)) - Number(Boolean(left.form)) ||
					left.subcategory.name.localeCompare(right.subcategory.name),
			)
			.slice(0, SUGGESTION_COUNT)
			.map((item) => ({
				id: item.subcategory.id,
				label: item.subcategory.name,
			}));
	}, [catalogue.data]);

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

	return (
		<TooltipProvider>
			<div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-7 py-6 sm:py-10">
				{/* The mark is drawn from the brand token rather than an image so it
				    tracks the theme; the blur gives it depth without an asset. */}
				<div className="relative size-16 shrink-0" aria-hidden="true">
					<div className="absolute inset-0 rounded-full bg-linear-to-br from-primary via-primary/70 to-primary/25 opacity-60 blur-md" />
					<div className="relative size-16 rounded-full bg-linear-to-br from-primary via-primary/80 to-primary/40 ring-1 ring-primary/25" />
					<div className="absolute inset-[30%] rounded-full bg-background" />
				</div>

				<div className="flex flex-col items-center gap-2 text-center">
					<h1 className="text-balance bg-linear-to-r from-primary to-primary/70 bg-clip-text font-semibold text-3xl text-transparent tracking-tight">
						{intakeCopy.composerTitle}
					</h1>
					<p className="max-w-md text-balance text-muted-foreground">
						{intakeCopy.composerDescription}
					</p>
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

					<PromptInputToolbar>
						<p className="pl-1 text-muted-foreground text-xs">
							{intakeCopy.submitHint}
						</p>
						<div className="flex items-center gap-1">
							<PromptInputMic />
							<PromptInputSubmit
								busy={busy}
								disabled={!canSubmit}
								onClick={submit}
							/>
						</div>
					</PromptInputToolbar>

					{draftId ? (
						<AttachmentTray
							draftId={draftId}
							disabled={busy}
							visionEnabled={visionEnabled}
							attachments={attachments}
							onAttachmentsChange={onAttachmentsChange}
						/>
					) : null}
				</PromptInput>

				{suggestions.length > 0 ? (
					<PromptInputSuggestion>
						{suggestions.map((suggestion) => (
							<PromptInputSuggestionChip
								key={suggestion.id}
								disabled={busy}
								onClick={() => setText(suggestion.label)}
							>
								{suggestion.label}
							</PromptInputSuggestionChip>
						))}
					</PromptInputSuggestion>
				) : null}

				<div className="flex flex-col items-center gap-2 text-center text-xs">
					<p className="max-w-md text-muted-foreground">
						{intakeCopy.privacyDescription}
						{visionEnabled ? ` ${intakeCopy.visionNotice}` : ""}
					</p>
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
