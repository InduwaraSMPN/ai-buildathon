import { RiStarFill, RiStarLine } from "@remixicon/react";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import z from "zod";
import { formatDate } from "@/components/ticket-ui";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Message, MessageContent } from "@/components/ui/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { conversationCopy } from "@/features/tickets/copy";
import { orpc, queryClient } from "@/utils/orpc";
import { createTicketFormSchemas, submitThenReset } from "./form-validation";

const { csat: csatSchema, reply: replySchema } = createTicketFormSchemas(z);

type TicketMessage = {
	id: string;
	authorType: "reporter" | "staff";
	body: string;
	createdAt: Date;
};

type Csat = {
	token: string;
	rating: number | null;
	comment: string | null;
	respondedAt: Date | null;
};

type ReplyValues = { body: string };
type CsatValues = { rating: number; comment: string };

export function ConversationCard({
	ticketId,
	messages,
}: {
	ticketId: string;
	messages: TicketMessage[];
}) {
	const reply = useMutation(
		orpc.addMyTicketMessage.mutationOptions({
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: orpc.getMyTicket.key({ input: { id: ticketId } }),
					}),
					queryClient.invalidateQueries({ queryKey: orpc.listTickets.key() }),
				]);
				toast.success(conversationCopy.replySent);
			},
			onError: () => toast.error(conversationCopy.replyError),
		}),
	);
	const form = useForm({
		defaultValues: {
			body: "",
		} as ReplyValues,
		validators: {
			onSubmit: replySchema,
		},
		onSubmit: ({ value }) =>
			submitThenReset(
				() => reply.mutateAsync({ ticketId, body: value.body.trim() }),
				() => form.reset(),
			),
	});
	return (
		<Card>
			<CardHeader className="border-b">
				<CardTitle>{conversationCopy.title}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{messages.length ? (
					<MessageScrollerProvider defaultScrollPosition="end">
						<MessageScroller className="max-h-96 min-h-0">
							<MessageScrollerViewport>
								<MessageScrollerContent>
									{messages.map((message) => {
										const isReporter = message.authorType === "reporter";
										return (
											<MessageScrollerItem
												key={message.id}
												messageId={message.id}
												scrollAnchor
											>
												<Message align={isReporter ? "end" : "start"}>
													<MessageContent>
														<Bubble
															align={isReporter ? "end" : "start"}
															variant={isReporter ? "default" : "muted"}
														>
															<BubbleContent>
																<div className="mb-2 flex justify-between gap-3 text-xs opacity-75">
																	<span>
																		{isReporter
																			? conversationCopy.reporter
																			: conversationCopy.staff}
																	</span>
																	<time>{formatDate(message.createdAt)}</time>
																</div>
																<p className="whitespace-pre-wrap">
																	{message.body}
																</p>
															</BubbleContent>
														</Bubble>
													</MessageContent>
												</Message>
											</MessageScrollerItem>
										);
									})}
								</MessageScrollerContent>
							</MessageScrollerViewport>
							<MessageScrollerButton />
						</MessageScroller>
					</MessageScrollerProvider>
				) : (
					<Empty>
						<EmptyDescription>{conversationCopy.empty}</EmptyDescription>
					</Empty>
				)}
				<form
					className="border-t pt-4"
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						void form.handleSubmit().catch(() => undefined);
					}}
				>
					<FieldGroup>
						<form.Field name="body">
							{(field) => {
								const invalid = field.state.meta.errors.length > 0;
								return (
									<Field data-invalid={invalid}>
										<FieldLabel htmlFor="portal-reply">
											{conversationCopy.replyLabel}
										</FieldLabel>
										<Textarea
											id="portal-reply"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											maxLength={10_000}
											placeholder={conversationCopy.replyPlaceholder}
											className="min-h-24"
											aria-invalid={invalid}
										/>
										<FieldError errors={field.state.meta.errors} />
									</Field>
								);
							}}
						</form.Field>
						<form.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
								body: state.values.body,
							})}
						>
							{({ canSubmit, isSubmitting, body }) => {
								const pending = isSubmitting || reply.isPending;
								return (
									<Button
										type="submit"
										disabled={
											!canSubmit ||
											!body.trim() ||
											body.trim().length > 10_000 ||
											pending
										}
									>
										{pending && <Spinner data-icon="inline-start" />}
										{pending
											? conversationCopy.sending
											: conversationCopy.sendReply}
									</Button>
								);
							}}
						</form.Subscribe>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}

export function CsatCard({ csat }: { csat: Csat }) {
	const submit = useMutation(
		orpc.submitTicketCsat.mutationOptions({
			onSuccess: () => toast.success(conversationCopy.feedbackSaved),
			onError: () => toast.error(conversationCopy.feedbackError),
		}),
	);
	const form = useForm({
		defaultValues: {
			rating: csat.rating ?? 0,
			comment: csat.comment ?? "",
		} as CsatValues,
		validators: {
			onSubmit: csatSchema,
		},
		onSubmit: async ({ value }) => {
			await submit.mutateAsync({
				token: csat.token,
				rating: value.rating,
				comment: value.comment.trim() || undefined,
			});
		},
	});
	if (csat.respondedAt || submit.isSuccess)
		return (
			<Card>
				<CardContent>
					<p className="font-medium">{conversationCopy.feedbackThanks}</p>
				</CardContent>
			</Card>
		);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{conversationCopy.feedbackTitle}</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						void form.handleSubmit().catch(() => undefined);
					}}
				>
					<FieldGroup>
						<form.Field name="rating">
							{(field) => {
								const invalid = field.state.meta.errors.length > 0;
								return (
									<Field data-invalid={invalid}>
										<fieldset className="flex gap-1" aria-invalid={invalid}>
											<legend className="sr-only">
												{conversationCopy.ratingLabel}
											</legend>
											{[1, 2, 3, 4, 5].map((value) => {
												const selected = value <= field.state.value;
												const StarIcon = selected ? RiStarFill : RiStarLine;
												return (
													<label
														key={value}
														className="cursor-pointer rounded-md p-1 focus-within:ring-2 focus-within:ring-ring"
													>
														<input
															type="radio"
															name={field.name}
															value={value}
															checked={field.state.value === value}
															onChange={() => field.handleChange(value)}
															className="sr-only"
														/>
														<span className="sr-only">
															{conversationCopy.stars(value)}
														</span>
														<StarIcon
															className={
																selected
																	? "size-7 text-warning"
																	: "size-7 text-muted-foreground"
															}
														/>
													</label>
												);
											})}
										</fieldset>
										<FieldError errors={field.state.meta.errors} />
									</Field>
								);
							}}
						</form.Field>
						<form.Field name="comment">
							{(field) => {
								const invalid = field.state.meta.errors.length > 0;
								return (
									<Field data-invalid={invalid}>
										<FieldLabel htmlFor="csat-comment" className="sr-only">
											{conversationCopy.feedbackLabel}
										</FieldLabel>
										<Textarea
											id="csat-comment"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											maxLength={2_000}
											placeholder={conversationCopy.feedbackPlaceholder}
											aria-invalid={invalid}
										/>
										<FieldError errors={field.state.meta.errors} />
									</Field>
								);
							}}
						</form.Field>
						<form.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
								rating: state.values.rating,
								comment: state.values.comment,
							})}
						>
							{({ canSubmit, isSubmitting, rating, comment }) => {
								const pending = isSubmitting || submit.isPending;
								return (
									<Button
										type="submit"
										disabled={
											!canSubmit ||
											!Number.isInteger(rating) ||
											rating < 1 ||
											rating > 5 ||
											comment.length > 2_000 ||
											pending
										}
									>
										{pending && <Spinner data-icon="inline-start" />}
										{pending
											? conversationCopy.submitting
											: conversationCopy.submitFeedback}
									</Button>
								);
							}}
						</form.Subscribe>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
