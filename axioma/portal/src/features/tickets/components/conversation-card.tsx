import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import z from "zod";
import { formatDate } from "@/components/ticket-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { conversationCopy } from "@/features/tickets/copy";
import { orpc, queryClient } from "@/utils/orpc";
import { createTicketFormSchemas, submitThenReset } from "./form-validation";

const { csat: csatSchema, reply: replySchema } = createTicketFormSchemas(z);

type Message = {
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
	messages: Message[];
}) {
	const reply = useMutation(
		orpc.addMyTicketMessage.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.getMyTicket.key({ input: { id: ticketId } }),
				});
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
		<Card className="rounded-xl">
			<CardHeader className="border-b">
				<CardTitle>{conversationCopy.title}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<ol className="space-y-3">
					{messages.length ? (
						messages.map((message) => (
							<li
								key={message.id}
								className={
									message.authorType === "reporter"
										? "ml-6 rounded-xl bg-primary p-4 text-primary-foreground"
										: "mr-6 rounded-xl bg-muted p-4"
								}
							>
								<div className="mb-2 flex justify-between gap-3 text-xs opacity-75">
									<span>
										{message.authorType === "reporter"
											? conversationCopy.reporter
											: conversationCopy.staff}
									</span>
									<time>{formatDate(message.createdAt)}</time>
								</div>
								<p className="whitespace-pre-wrap text-sm leading-6">
									{message.body}
								</p>
							</li>
						))
					) : (
						<li className="rounded-xl border border-dashed p-5 text-center text-muted-foreground text-sm">
							{conversationCopy.empty}
						</li>
					)}
				</ol>
				<form
					className="space-y-3 border-t pt-4"
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						void form.handleSubmit().catch(() => undefined);
					}}
				>
					<form.Field name="body">
						{(field) => (
							<div className="space-y-2">
								<label htmlFor="portal-reply" className="font-medium text-sm">
									{conversationCopy.replyLabel}
								</label>
								<Textarea
									id="portal-reply"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									maxLength={10_000}
									placeholder={conversationCopy.replyPlaceholder}
									className="min-h-24"
									aria-invalid={field.state.meta.errors.length > 0}
								/>
								{field.state.meta.errors.length ? (
									<p className="text-destructive text-sm" role="alert">
										{field.state.meta.errors[0]?.message}
									</p>
								) : null}
							</div>
						)}
					</form.Field>
					<form.Subscribe
						selector={(state) => ({
							canSubmit: state.canSubmit,
							isSubmitting: state.isSubmitting,
							body: state.values.body,
						})}
					>
						{({ canSubmit, isSubmitting, body }) => (
							<Button
								type="submit"
								disabled={
									!canSubmit ||
									!body.trim() ||
									body.trim().length > 10_000 ||
									isSubmitting ||
									reply.isPending
								}
							>
								{isSubmitting || reply.isPending
									? conversationCopy.sending
									: conversationCopy.sendReply}
							</Button>
						)}
					</form.Subscribe>
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
			<Card className="rounded-xl">
				<CardContent>
					<p className="font-medium">{conversationCopy.feedbackThanks}</p>
				</CardContent>
			</Card>
		);
	return (
		<Card className="rounded-xl">
			<CardHeader>
				<CardTitle>{conversationCopy.feedbackTitle}</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						void form.handleSubmit().catch(() => undefined);
					}}
				>
					<form.Field name="rating">
						{(field) => (
							<div className="space-y-2">
								<fieldset className="flex gap-1">
									<legend className="sr-only">
										{conversationCopy.ratingLabel}
									</legend>
									{[1, 2, 3, 4, 5].map((value) => (
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
											<Star
												className={
													value <= field.state.value
														? "size-7 fill-amber-400 text-amber-500"
														: "size-7 text-muted-foreground"
												}
											/>
										</label>
									))}
								</fieldset>
								{field.state.meta.errors.length ? (
									<p className="text-destructive text-sm" role="alert">
										{field.state.meta.errors[0]?.message}
									</p>
								) : null}
							</div>
						)}
					</form.Field>
					<form.Field name="comment">
						{(field) => (
							<div className="space-y-2">
								<label htmlFor="csat-comment" className="sr-only">
									{conversationCopy.feedbackLabel}
								</label>
								<Textarea
									id="csat-comment"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									maxLength={2_000}
									placeholder={conversationCopy.feedbackPlaceholder}
									aria-invalid={field.state.meta.errors.length > 0}
								/>
								{field.state.meta.errors.length ? (
									<p className="text-destructive text-sm" role="alert">
										{field.state.meta.errors[0]?.message}
									</p>
								) : null}
							</div>
						)}
					</form.Field>
					<form.Subscribe
						selector={(state) => ({
							canSubmit: state.canSubmit,
							isSubmitting: state.isSubmitting,
							rating: state.values.rating,
							comment: state.values.comment,
						})}
					>
						{({ canSubmit, isSubmitting, rating, comment }) => (
							<Button
								type="submit"
								disabled={
									!canSubmit ||
									!Number.isInteger(rating) ||
									rating < 1 ||
									rating > 5 ||
									comment.length > 2_000 ||
									isSubmitting ||
									submit.isPending
								}
							>
								{isSubmitting || submit.isPending
									? conversationCopy.submitting
									: conversationCopy.submitFeedback}
							</Button>
						)}
					</form.Subscribe>
				</form>
			</CardContent>
		</Card>
	);
}
