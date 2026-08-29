import { useMutation } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/components/ticket-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { conversationCopy } from "@/features/tickets/copy";
import { orpc, queryClient } from "@/utils/orpc";

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

export function ConversationCard({
	ticketId,
	messages,
}: {
	ticketId: string;
	messages: Message[];
}) {
	const [body, setBody] = useState("");
	const reply = useMutation(
		orpc.addMyTicketMessage.mutationOptions({
			onSuccess: async () => {
				setBody("");
				await queryClient.invalidateQueries({
					queryKey: orpc.getMyTicket.key({ input: { id: ticketId } }),
				});
				toast.success(conversationCopy.replySent);
			},
			onError: () => toast.error(conversationCopy.replyError),
		}),
	);
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
						const message = body.trim();
						if (message) reply.mutate({ ticketId, body: message });
					}}
				>
					<label htmlFor="portal-reply" className="font-medium text-sm">
						{conversationCopy.replyLabel}
					</label>
					<Textarea
						id="portal-reply"
						value={body}
						onChange={(event) => setBody(event.target.value)}
						maxLength={10_000}
						placeholder={conversationCopy.replyPlaceholder}
						className="min-h-24"
					/>
					<Button type="submit" disabled={!body.trim() || reply.isPending}>
						{reply.isPending
							? conversationCopy.sending
							: conversationCopy.sendReply}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

export function CsatCard({ csat }: { csat: Csat }) {
	const [rating, setRating] = useState(csat.rating ?? 0);
	const [comment, setComment] = useState(csat.comment ?? "");
	const submit = useMutation(
		orpc.submitTicketCsat.mutationOptions({
			onSuccess: () => toast.success(conversationCopy.feedbackSaved),
			onError: () => toast.error(conversationCopy.feedbackError),
		}),
	);
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
						if (rating)
							submit.mutate({
								token: csat.token,
								rating,
								comment: comment.trim() || undefined,
							});
					}}
				>
					<fieldset className="flex gap-1">
						<legend className="sr-only">{conversationCopy.ratingLabel}</legend>
						{[1, 2, 3, 4, 5].map((value) => (
							<label
								key={value}
								className="cursor-pointer rounded-md p-1 focus-within:ring-2 focus-within:ring-ring"
							>
								<input
									type="radio"
									name="rating"
									value={value}
									checked={rating === value}
									onChange={() => setRating(value)}
									className="sr-only"
								/>
								<span className="sr-only">{conversationCopy.stars(value)}</span>
								<Star
									className={
										value <= rating
											? "size-7 fill-amber-400 text-amber-500"
											: "size-7 text-muted-foreground"
									}
								/>
							</label>
						))}
					</fieldset>
					<label htmlFor="csat-comment" className="sr-only">
						{conversationCopy.feedbackLabel}
					</label>
					<Textarea
						id="csat-comment"
						value={comment}
						onChange={(event) => setComment(event.target.value)}
						maxLength={2_000}
						placeholder={conversationCopy.feedbackPlaceholder}
					/>
					<Button type="submit" disabled={!rating || submit.isPending}>
						{submit.isPending
							? conversationCopy.submitting
							: conversationCopy.submitFeedback}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
