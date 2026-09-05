import { RiArrowLeftLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { AxiomaMark } from "@/components/brand";
import { PageHeading, PageShell, panelCardClass } from "@/components/ticket-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	sendIntakeMessage,
	useDiscardIntakeDraft,
	useIntakeCapabilities,
	usePatchIntakeDraft,
	useStartIntakeDraft,
	useSubmitIntakeDraft,
} from "@/features/intake/api/mutations";
import { DeflectionCards } from "@/features/intake/components/deflection-cards";
import { DraftReview } from "@/features/intake/components/draft-review";
import { IntakeComposer } from "@/features/intake/components/intake-composer";
import { IntakeConversation } from "@/features/intake/components/intake-conversation";
import { intakeCopy } from "@/features/intake/copy";
import {
	addUserMessage,
	applyDraft,
	confirmSubcategory,
	fromIncidentValues,
	initialDraftState,
	reduceIntakeEvent,
	revertFieldToAi,
	setDraftId,
	setFieldValue,
} from "@/features/intake/state/draft-reducer";
import {
	clearSavedDraft,
	readSavedDraftId,
	readSavedReadFlags,
	saveDraftId,
	saveReadFlags,
	takeSavedDraftValues,
	writeSavedDraftValues,
} from "@/features/intake/state/draft-session";
import type { DraftAttachment } from "@/features/intake/types";
import type { RequestFormInitialValues } from "@/features/tickets/components/request-form";
import { RequestForm } from "@/features/tickets/components/request-form";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type NewTicketSearch = { mode?: "manual" };

export const Route = createFileRoute("/_auth/tickets/new")({
	component: RouteComponent,
	validateSearch: (search: Record<string, unknown>): NewTicketSearch =>
		search.mode === "manual" ? { mode: "manual" } : {},
	head: () => ({ meta: [{ title: intakeCopy.pageTitle }] }),
});

function RouteComponent() {
	const { mode } = Route.useSearch();
	const capabilities = useIntakeCapabilities();

	if (capabilities.isPending) {
		return (
			<PageShell>
				<div className="flex min-h-[40vh] items-center justify-center">
					<Spinner />
				</div>
			</PageShell>
		);
	}

	if (mode === "manual" || !capabilities.data?.enabled) return <ManualBranch />;

	return <IntakeFlow />;
}

/**
 * The plain form, and the only branch at all when `AXIOMA_LLM_KEY` is unset.
 * Values carried over from the assistant are consumed in an effect rather than
 * read during render: reading them on every render and never clearing them left
 * every later visit pre-filled with a request the employee had already sent.
 */
function ManualBranch() {
	const [initialValues, setInitialValues] = useState<
		RequestFormInitialValues | undefined
	>();
	const [ready, setReady] = useState(false);
	useEffect(() => {
		setInitialValues(takeSavedDraftValues());
		setReady(true);
	}, []);
	return (
		<PageShell>
			{/* The form column is narrower than the shell, so centre the whole
			    column — back link and heading included — rather than leaving it
			    pinned left against an empty right gutter. */}
			<div className="mx-auto w-full max-w-2xl">
				<BackLink />
				<PageHeading
					eyebrow={intakeCopy.eyebrow}
					title={intakeCopy.composerTitle}
					description={intakeCopy.composerDescription}
				/>
				<Card>
					<CardHeader className="border-b">
						<CardTitle className="text-base">
							{intakeCopy.manualCardTitle}
						</CardTitle>
					</CardHeader>
					<CardContent>
						{/* Mounted only once the carried values are known, so the
						    uncontrolled form is not built from an empty first pass. */}
						{ready ? (
							<RequestForm initialValues={initialValues} />
						) : (
							<Spinner />
						)}
					</CardContent>
				</Card>
			</div>
		</PageShell>
	);
}

function BackLink() {
	return (
		<Link
			to="/home"
			className={buttonVariants({
				variant: "ghost",
				size: "sm",
				className: "mb-6 -ml-2",
			})}
		>
			<RiArrowLeftLine data-icon="inline-start" aria-hidden="true" />
			Back to home
		</Link>
	);
}

function IntakeFlow() {
	const [flowKey, setFlowKey] = useState(0);
	return (
		<IntakeRouter key={flowKey} onReset={() => setFlowKey((key) => key + 1)} />
	);
}

function IntakeRouter({ onReset }: { onReset: () => void }) {
	const [state, setState] = useState(() => initialDraftState());
	const navigate = useNavigate();
	const capabilities = useIntakeCapabilities();
	const start = useStartIntakeDraft();
	const patch = usePatchIntakeDraft();
	const submit = useSubmitIntakeDraft();
	const discard = useDiscardIntakeDraft();
	const catalogue = useQuery(orpc.listRequestCatalogue.queryOptions());
	const abortRef = useRef<AbortController | null>(null);
	const idempotencyKey = useRef(crypto.randomUUID());
	// Held here rather than in the composer: the composer unmounts on every
	// stage change, and the documents stay linked to the draft, so a tray that
	// reset would quietly re-enable reading a screenshot the user opted out of.
	const [attachments, setAttachments] = useState<DraftAttachment[]>([]);

	// Set once the mount effect has settled, so the tray is never written back to
	// storage before the rehydrate has had a chance to read it.
	const hydrated = useRef(false);

	// `start` is a new object on every render, so listing it as a dependency
	// re-fired this effect each time the mutation's own state changed — once per
	// render until the first response landed, each pass minting another orphaned
	// draft row. The ref makes the request happen exactly once per mount.
	const startRequested = useRef(false);
	useEffect(() => {
		if (state.draftId || startRequested.current) return;
		startRequested.current = true;
		const startFresh = () =>
			start.mutate(undefined, {
				onSuccess: (draft) => {
					saveDraftId(draft.id);
					hydrated.current = true;
					setState((prev) => setDraftId(prev, draft.id));
				},
				onError: () => {
					startRequested.current = false;
				},
			});
		const saved = readSavedDraftId();
		if (!saved) {
			startFresh();
			return;
		}
		void (async () => {
			try {
				const [draft, documents] = await Promise.all([
					orpc.getIntakeDraft.call({ draftId: saved }),
					orpc.listDocuments.call({
						targetType: "draft",
						targetId: saved,
					}),
				]);
				if (draft) {
					// The documents come back from the server, but the per-file
					// "let Axel read this" choice is client-only, so it is restored
					// from storage — and an id with no stored choice is treated as
					// opted OUT. A reload must never re-enable reading a screenshot
					// the user excluded.
					const flags = readSavedReadFlags(saved);
					hydrated.current = true;
					setAttachments(
						documents.map((item) => ({
							key: item.id,
							id: item.id,
							name: item.displayName,
							kind:
								item.kind === "file" &&
								(item.mediaType?.startsWith("image/") ?? false)
									? "image"
									: "file",
							status: "done" as const,
							read: flags[item.id] === true,
						})),
					);
					setState((prev) => applyDraft(prev, draft));
					return;
				}
				clearSavedDraft();
			} catch {
				// A draft whose attachments could not be listed is not resumable:
				// carrying on would show an empty tray over documents still linked
				// server-side, which is the opt-out regression this guards against.
				clearSavedDraft();
			}
			startFresh();
		})();
	}, [state.draftId, start.mutate]);

	useEffect(() => {
		if (!hydrated.current || !state.draftId) return;
		saveReadFlags(state.draftId, attachments);
	}, [state.draftId, attachments]);

	useEffect(
		() => () => {
			abortRef.current?.abort();
		},
		[],
	);

	// Returns whether the message was accepted. The composer used to clear the
	// textarea unconditionally, so anything typed before `startIntakeDraft`
	// resolved vanished with no error and no spinner.
	const handleMessage = (body: string): boolean => {
		if (!state.draftId || state.streaming) return false;
		setState((prev) => addUserMessage(prev, body));
		// Replacing the ref without aborting left the previous stream running.
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		const excludedAttachments = attachments
			.filter((entry) => entry.id && !entry.read)
			.map((entry) => entry.id);
		void sendIntakeMessage(
			state.draftId,
			body,
			(event) => setState((prev) => reduceIntakeEvent(prev, event)),
			controller.signal,
			excludedAttachments.length ? excludedAttachments : undefined,
		).catch(() =>
			setState((prev) =>
				reduceIntakeEvent(prev, {
					type: "error",
					code: "NETWORK",
					message: intakeCopy.unexpectedError,
				}),
			),
		);
		return true;
	};

	const handleCreateAnyway = () => {
		handleMessage(intakeCopy.createAnywayMessage);
	};

	const handleSolved = () => {
		if (state.draftId) discard.mutate({ draftId: state.draftId });
		clearSavedDraft();
		onReset();
	};

	const handleManual = () => {
		writeSavedDraftValues({
			title: state.values.title,
			body: state.values.body,
			impact: state.values.impact,
			urgency: state.values.urgency,
			deviceId: state.values.deviceId,
			customFields: state.values.customFields,
			subcategoryId: state.subcategoryId ?? undefined,
			catalogueValues: state.values.formValues,
		});
		void navigate({ to: "/tickets/new", search: { mode: "manual" } });
	};

	const handleSubmit = async () => {
		if (!state.draftId || submit.isPending) return;
		const values = fromIncidentValues(state.values);
		const sources = { ...state.fieldSources };

		const item = catalogue.data?.find(
			(entry) => entry.subcategory.id === state.subcategoryId,
		);
		if (item?.form) {
			values.formId = item.form.id;
			values.formValues = state.values.formValues ?? {};
			sources.formId = "user";
			sources.formValues = sources.formValues ?? "user";
		}

		try {
			await patch.mutateAsync({ draftId: state.draftId, values, sources });
			const result = await submit.mutateAsync({
				draftId: state.draftId,
				// Held in a ref, as the manual path does: minting a fresh key per
				// click means a retry after a failed send creates a second ticket
				// instead of returning the first.
				idempotencyKey: idempotencyKey.current,
			});
			clearSavedDraft();
			await navigate({
				to: "/tickets/$ticketId",
				params: { ticketId: result.ticketId },
			});
		} catch {
			// Both mutations toast their own failure; the draft stays on screen so
			// the user can press the button again.
		}
	};

	const composer = (variant: "hero" | "docked") => (
		<IntakeComposer
			variant={variant}
			draftId={state.draftId}
			streaming={state.streaming}
			visionEnabled={capabilities.data?.vision ?? false}
			attachments={attachments}
			onAttachmentsChange={setAttachments}
			onSubmit={handleMessage}
			onManual={handleManual}
		/>
	);

	if (state.stage === "compose") {
		return (
			<PageShell>
				<BackLink />
				<div className="flex min-h-[calc(100vh-14rem)] items-center justify-center">
					{composer("hero")}
				</div>
			</PageShell>
		);
	}

	const deflection = state.articles.length > 0;

	if (state.stage === "triage") {
		return (
			<PageShell>
				<BackLink />
				{/* The panel is as tall as the viewport allows, so the transcript —
				    not a second copy of the landing hero — is what fills the screen
				    once the conversation has started. */}
				<Card
					className={cn(
						panelCardClass,
						"mx-auto flex h-[calc(100vh-14rem)] min-h-[32rem] w-full max-w-3xl flex-col gap-0 p-0 py-0",
					)}
				>
					<AssistantRail onManual={handleManual} />
					<div className="min-h-0 flex-1">
						<IntakeConversation
							transcript={state.transcript}
							streaming={state.streaming}
							busyStage={state.busyStage}
							assistantMessage={state.assistantMessage}
							articleCount={state.articles.length}
							stage={state.stage}
							error={state.error}
							onDeflectionSolved={handleSolved}
							onDeflectionContinue={handleCreateAnyway}
							onManual={handleManual}
							renderDeflection={
								deflection
									? () => (
											<DeflectionCards
												articles={state.articles}
												onSolved={handleSolved}
												onContinue={handleCreateAnyway}
											/>
										)
									: undefined
							}
						/>
					</div>
					{/* Always available: a deflection ends the turn with `complete`, and
					    gating the composer on that left the user with two buttons and
					    no way to type a follow-up. */}
					<div className="border-t bg-muted/30 p-2.5">{composer("docked")}</div>
				</Card>
			</PageShell>
		);
	}

	return (
		<PageShell>
			<BackLink />
			{/* The question has been answered by this point, so the heading stops
			    asking it. */}
			<PageHeading
				eyebrow={intakeCopy.eyebrow}
				title={intakeCopy.reviewTitle}
				description={intakeCopy.reviewDescription}
			/>
			<ReviewLayout
				conversation={
					<IntakeConversation
						transcript={state.transcript}
						streaming={state.streaming}
						busyStage={state.busyStage}
						assistantMessage={state.assistantMessage}
						articleCount={state.articles.length}
						stage={state.stage}
						error={state.error}
						onDeflectionSolved={handleSolved}
						onDeflectionContinue={handleCreateAnyway}
						onManual={handleManual}
					/>
				}
				review={
					<DraftReview
						state={state}
						submitting={submit.isPending}
						onFieldChange={(key, value) =>
							setState((prev) => setFieldValue(prev, key, value))
						}
						onRevert={(key) => setState((prev) => revertFieldToAi(prev, key))}
						onConfirmSubcategory={() =>
							setState((prev) => confirmSubcategory(prev))
						}
						onSubmit={handleSubmit}
					/>
				}
				composer={composer("docked")}
				onManual={handleManual}
				messageKey={`${state.transcript.length}:${state.assistantMessage.length}:${state.articles.length}`}
			/>
		</PageShell>
	);
}

function ReviewLayout({
	conversation,
	review,
	composer,
	onManual,
	messageKey,
}: {
	conversation: ReactNode;
	review: ReactNode;
	/**
	 * The rail keeps a live composer rather than a single canned "add more
	 * detail" message: the employee reading the draft is exactly the person who
	 * has the detail it is missing, and typing it is how they said everything
	 * else on the page.
	 */
	composer: ReactNode;
	onManual: () => void;
	/** Changes whenever the assistant says something new. */
	messageKey: string;
}) {
	const [activeTab, setActiveTab] = useState("request");
	const wide = useIsWide();
	// The Conversation tab badge means a *new* message, so it clears once the
	// conversation has actually been on screen.
	const [seenKey, setSeenKey] = useState<string | null>(null);
	useEffect(() => {
		if (activeTab === "conversation") setSeenKey(messageKey);
	}, [activeTab, messageKey]);
	const hasNewMessage = messageKey !== seenKey;

	// `hidden` and `lg:hidden` are CSS-only, so rendering the two-pane layout
	// beside the tab layout mounted every child twice: duplicate element ids
	// broke each label's htmlFor, and the page carried two "Approve and send"
	// buttons and two live regions announcing the same text. Choose one tree.
	if (wide)
		return (
			// The conversation is reference material and the form is the work, so
			// the rail is fixed to the viewport and keeps its own scroll while the
			// request scrolls the page. The two used to be equal-height columns,
			// which left the transcript column mostly empty beside a form several
			// screens long.
			<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
				<Card
					className={cn(
						panelCardClass,
						"sticky top-[5.5rem] flex h-[calc(100vh-7rem)] min-h-0 flex-col gap-0 p-0 py-0",
					)}
				>
					<AssistantRail onManual={onManual} />
					<CardContent className="min-h-0 flex-1 p-0">
						{conversation}
					</CardContent>
					<div className="border-t bg-muted/30 p-2.5">{composer}</div>
				</Card>
				<Card className={cn(panelCardClass, "min-h-0 overflow-visible p-0")}>
					<CardContent className="p-4 sm:p-6">{review}</CardContent>
				</Card>
			</div>
		);

	return (
		<Tabs value={activeTab} onValueChange={setActiveTab}>
			<TabsList>
				<TabsTrigger value="conversation" className="gap-1.5">
					{intakeCopy.conversationTab}
					{hasNewMessage && activeTab !== "conversation" ? (
						<>
							<span
								className="size-2 rounded-full bg-primary"
								aria-hidden="true"
							/>
							{/* The dot is the only cue that the assistant replied while the
							    form tab is showing, so it needs a name of its own. */}
							<span className="sr-only">{intakeCopy.newMessage}</span>
						</>
					) : null}
				</TabsTrigger>
				<TabsTrigger value="request">{intakeCopy.requestTab}</TabsTrigger>
			</TabsList>
			<TabsContent value="conversation">
				<Card
					className={cn(
						panelCardClass,
						"flex h-[60vh] flex-col gap-0 p-0 py-0",
					)}
				>
					<AssistantRail onManual={onManual} />
					<CardContent className="min-h-0 flex-1 p-0">
						{conversation}
					</CardContent>
					<div className="border-t bg-muted/30 p-2.5">{composer}</div>
				</Card>
			</TabsContent>
			<TabsContent value="request">
				<Card className={cn(panelCardClass, "overflow-visible p-0")}>
					<CardContent className="p-4 sm:p-6">{review}</CardContent>
				</Card>
			</TabsContent>
		</Tabs>
	);
}

/**
 * Who is on the other end of the transcript, and the one thing to do with it.
 * The triage panel had no header at all, so the composer underneath was
 * carrying the brand mark, the page heading and the escape link inside a chat
 * footer; the rail takes those back and leaves the composer as an input.
 */
function AssistantRail({ onManual }: { onManual: () => void }) {
	return (
		<div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
			<div className="flex min-w-0 items-center gap-2.5">
				<span
					className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
					aria-hidden="true"
				>
					<AxiomaMark className="size-4" />
				</span>
				<div className="min-w-0">
					<p className="font-heading font-medium text-sm leading-tight">
						{intakeCopy.assistant}
					</p>
					<p className="truncate text-muted-foreground text-xs">
						{intakeCopy.assistantRole}
					</p>
				</div>
			</div>
			<Button variant="ghost" size="sm" onClick={onManual}>
				{intakeCopy.manualEscape}
			</Button>
		</div>
	);
}

/** Matches the `lg` breakpoint so only one review layout is ever mounted. */
function useIsWide() {
	const [wide, setWide] = useState(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia("(min-width: 64rem)").matches,
	);
	useEffect(() => {
		const query = window.matchMedia("(min-width: 64rem)");
		const onChange = (event: MediaQueryListEvent) => setWide(event.matches);
		setWide(query.matches);
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, []);
	return wide;
}
