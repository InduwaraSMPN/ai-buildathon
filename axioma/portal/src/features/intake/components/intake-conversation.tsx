import type { ReactNode } from "react";
import { useMemo } from "react";
import { AxiomaMark } from "@/components/brand";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
	Message,
	MessageAvatar,
	MessageContent,
	MessageGroup,
} from "@/components/ui/message";
import {
	MessageScroller,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedAnnouncement } from "@/features/intake/announce";
import { intakeCopy, intakeErrorCopy } from "@/features/intake/copy";
import type { IntakeStage, TranscriptEntry } from "@/features/intake/types";

/**
 * Work in progress, not speech. It sits outside the bubble run so a machine
 * state is never mistaken for something the assistant said.
 */
function StatusLine({ text }: { text: string }) {
	return (
		<div
			className="flex items-center gap-2 pl-10 text-muted-foreground text-sm"
			role="status"
		>
			<span className="flex gap-1" aria-hidden="true">
				<Skeleton className="size-1.5 rounded-full bg-primary/60" />
				<Skeleton className="size-1.5 rounded-full bg-primary/60 [animation-delay:150ms]" />
				<Skeleton className="size-1.5 rounded-full bg-primary/60 [animation-delay:300ms]" />
			</span>
			{text}
		</div>
	);
}

function AssistantBubble({ children }: { children: ReactNode }) {
	return (
		<Message align="start">
			<MessageAvatar className="size-8 self-start bg-primary/10 text-primary">
				<AxiomaMark className="size-4" aria-hidden="true" />
			</MessageAvatar>
			<MessageContent>
				<Bubble variant="muted" align="start">
					<BubbleContent className="rounded-2xl rounded-tl-sm px-3.5 py-2.5">
						{children}
					</BubbleContent>
				</Bubble>
			</MessageContent>
		</Message>
	);
}

export function IntakeConversation({
	transcript,
	streaming,
	busyStage,
	assistantMessage,
	articleCount,
	stage,
	error,
	onDeflectionSolved,
	onDeflectionContinue,
	onManual,
	renderDeflection,
}: {
	transcript: TranscriptEntry[];
	streaming: boolean;
	busyStage:
		| "retrieving"
		| "reading_attachments"
		| "drafting"
		| "classifying"
		| null;
	assistantMessage: string;
	articleCount: number;
	stage: IntakeStage;
	/** The reducer's failed turn. Nothing used to render it, so a failure was silent. */
	error: { code: string; message: string } | null;
	onDeflectionSolved: () => void;
	onDeflectionContinue: () => void;
	onManual: () => void;
	renderDeflection?: (args: {
		onSolved: () => void;
		onContinue: () => void;
	}) => ReactNode;
}) {
	const deflection = articleCount > 0;

	// The debounced summary announcement lives on the transcript for stage 2,
	// where the assistant's reply and the deflection result are the only things
	// that change and a screen reader user would otherwise hear nothing but the
	// status line. Stage 3 keeps its announcement on the form, which is the
	// surface that fills itself in there; both regions are mounted in stage 3, so
	// this one goes quiet to stop the same turn being read out twice.
	const summary = useMemo(() => {
		if (stage !== "triage") return "";
		const parts = [
			assistantMessage.trim(),
			deflection ? intakeCopy.articlesSuggested(articleCount) : "",
		];
		return parts.filter(Boolean).join(" ");
	}, [stage, assistantMessage, deflection, articleCount]);
	const announcement = useDebouncedAnnouncement(summary, streaming);

	// A turn with nothing to show yet would render an empty bubble under the
	// status line, so the bubble is mounted only once it has content.
	const pending = streaming || stage === "triage";

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Never focused and never wrapped around the transcript: wrapping it
			    re-announced every streamed delta and nested the status line inside
			    the region. `aria-atomic="false"` so only the new summary is read. */}
			<div
				className="sr-only"
				aria-live="polite"
				aria-atomic="false"
				aria-busy={streaming ? "true" : "false"}
			>
				{announcement}
			</div>
			<div className="min-h-0 flex-1">
				<MessageScroller>
					<MessageScrollerViewport>
						<MessageScrollerContent className="gap-4 px-4 py-5 sm:px-5">
							<MessageGroup className="gap-4">
								{transcript.map((entry, index) =>
									entry.role === "assistant" ? (
										// biome-ignore lint/suspicious/noArrayIndexKey: transcript is append-only and has no stable id
										<MessageScrollerItem key={`${entry.role}-${index}`}>
											<AssistantBubble>{entry.body}</AssistantBubble>
										</MessageScrollerItem>
									) : (
										// biome-ignore lint/suspicious/noArrayIndexKey: transcript is append-only and has no stable id
										<MessageScrollerItem key={`${entry.role}-${index}`}>
											<Message align="end">
												<MessageContent>
													<BubbleGroup>
														{/* Tinted, not solid: the employee's own words are
														    read far more often than the brand needs a block
														    of green, and this keeps them on foreground
														    contrast at any bubble length. */}
														<Bubble variant="tinted" align="end">
															<BubbleContent className="rounded-2xl rounded-br-sm px-3.5 py-2.5">
																{entry.body}
															</BubbleContent>
														</Bubble>
													</BubbleGroup>
												</MessageContent>
											</Message>
										</MessageScrollerItem>
									),
								)}
							</MessageGroup>

							{pending ? (
								<MessageScrollerItem scrollAnchor>
									<div className="flex min-w-0 flex-col gap-3">
										{busyStage ? (
											<StatusLine text={intakeCopy.statusLabel[busyStage]} />
										) : null}
										{assistantMessage ? (
											<AssistantBubble>
												<div className="whitespace-pre-wrap">
													{assistantMessage}
												</div>
											</AssistantBubble>
										) : null}
										{/* Outside the bubble, indented to the bubble column: an
										    article the employee is asked to read is capped at 80%
										    of the rail inside one, which is where the deflection
										    cards were being squeezed. */}
										{deflection && renderDeflection ? (
											<div className="pl-10">
												{renderDeflection({
													onSolved: onDeflectionSolved,
													onContinue: onDeflectionContinue,
												})}
											</div>
										) : null}
									</div>
								</MessageScrollerItem>
							) : null}
						</MessageScrollerContent>
					</MessageScrollerViewport>
				</MessageScroller>
			</div>
			{/* Pinned below the transcript rather than scrolled into it, so the one
			    thing the employee has to act on sits directly above the composer. */}
			{error ? (
				<div className="border-t p-4">
					<Alert variant="destructive">
						<AlertTitle>{intakeCopy.errorHeading}</AlertTitle>
						{/* Never the server's own `message`: it is written for whoever
						    reads the logs, not for the person who hit the wall. */}
						<AlertDescription>{intakeErrorCopy(error.code)}</AlertDescription>
						{/* The turn limit is the one failure retrying cannot clear, so it
						    is the one that has to hand over the escape hatch. */}
						{error.code === "MAX_TURNS_EXCEEDED" ? (
							<Button
								variant="outline"
								size="sm"
								className="mt-2 justify-self-start"
								onClick={onManual}
							>
								{intakeCopy.manualEscape}
							</Button>
						) : null}
					</Alert>
				</div>
			) : null}
		</div>
	);
}
