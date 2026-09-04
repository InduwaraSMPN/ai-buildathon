import { RiRobot2Line } from "@remixicon/react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";
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
import { intakeCopy } from "@/features/intake/copy";
import type { IntakeStage, TranscriptEntry } from "@/features/intake/types";

function StatusLine({ text }: { text: string }) {
	return (
		<div
			className="flex items-center gap-2 text-muted-foreground text-sm"
			role="status"
		>
			<RiRobot2Line className="size-4 shrink-0" aria-hidden="true" />
			<span className="flex items-center gap-1.5">
				{text}
				<span className="flex gap-0.5" aria-hidden="true">
					<Skeleton className="size-1 rounded-full bg-current" />
					<Skeleton className="size-1 rounded-full bg-current [animation-delay:150ms]" />
					<Skeleton className="size-1 rounded-full bg-current [animation-delay:300ms]" />
				</span>
			</span>
		</div>
	);
}

function AssistantBubble({ children }: { children: ReactNode }) {
	return (
		<Message align="start">
			<MessageAvatar className="bg-muted text-muted-foreground">
				<RiRobot2Line className="size-4" aria-hidden="true" />
			</MessageAvatar>
			<MessageContent>
				<Bubble variant="outline" align="start">
					<BubbleContent>{children}</BubbleContent>
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
	onDeflectionSolved,
	onDeflectionContinue,
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
	onDeflectionSolved: () => void;
	onDeflectionContinue: () => void;
	renderDeflection?: (args: {
		onSolved: () => void;
		onContinue: () => void;
	}) => ReactNode;
}) {
	const deflection = articleCount > 0;

	// §2.9 lives on the transcript for stage 2, where the assistant's reply and
	// the deflection result are the only things that change and a screen reader
	// user would otherwise hear nothing but the status line. Stage 3 keeps its
	// announcement on the form, which is the surface that fills itself in there;
	// both regions are mounted in stage 3, so this one goes quiet to stop the
	// same turn being read out twice.
	const summary = useMemo(() => {
		if (stage !== "triage") return "";
		const parts = [
			assistantMessage.trim(),
			deflection ? intakeCopy.articlesSuggested(articleCount) : "",
		];
		return parts.filter(Boolean).join(" ");
	}, [stage, assistantMessage, deflection, articleCount]);
	const announcement = useDebouncedAnnouncement(summary, streaming);

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
			<MessageScroller>
				<MessageScrollerViewport>
					<MessageScrollerContent className="px-4 py-4">
						<MessageGroup>
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
													<Bubble align="end">
														<BubbleContent>{entry.body}</BubbleContent>
													</Bubble>
												</BubbleGroup>
											</MessageContent>
										</Message>
									</MessageScrollerItem>
								),
							)}
						</MessageGroup>

						{streaming || stage === "triage" ? (
							<MessageScrollerItem scrollAnchor>
								<AssistantBubble>
									<div className="flex min-w-0 flex-col gap-2">
										{busyStage ? (
											<StatusLine text={intakeCopy.statusLabel[busyStage]} />
										) : null}
										{assistantMessage ? (
											<div className="whitespace-pre-wrap">
												{assistantMessage}
											</div>
										) : null}
										{deflection && renderDeflection
											? renderDeflection({
													onSolved: onDeflectionSolved,
													onContinue: onDeflectionContinue,
												})
											: null}
									</div>
								</AssistantBubble>
							</MessageScrollerItem>
						) : null}
					</MessageScrollerContent>
				</MessageScrollerViewport>
			</MessageScroller>
		</div>
	);
}
