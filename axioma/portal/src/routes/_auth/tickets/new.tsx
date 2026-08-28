import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Send } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { PageHeading, PageShell } from "@/components/ticket-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/tickets/new")({
	component: RouteComponent,
	head: () => ({ meta: [{ title: "New request · Axioma" }] }),
});

function RouteComponent() {
	const navigate = useNavigate();
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const createTicket = useMutation(
		orpc.createTicket.mutationOptions({
			onSuccess: async (ticket) => {
				await queryClient.invalidateQueries({
					queryKey: orpc.listTickets.key(),
				});
				toast.success("Request sent");
				await navigate({
					to: "/tickets/$ticketId",
					params: { ticketId: ticket.id },
				});
			},
			onError: () =>
				toast.error("We couldn’t send your request. Please try again."),
		}),
	);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		createTicket.mutate({
			title: title.trim(),
			body: body.trim(),
		});
	}

	return (
		<PageShell>
			<Link
				to="/home"
				className={buttonVariants({
					variant: "ghost",
					size: "sm",
					className: "mb-6 -ml-2",
				})}
			>
				<ArrowLeft aria-hidden="true" /> Back to requests
			</Link>
			<PageHeading
				eyebrow="New support request"
				title="What can we help with?"
				description="Share what’s getting in your way. Clear details help us get you to the right solution sooner."
			/>
			<Card className="max-w-3xl rounded-xl">
				<CardHeader className="border-b">
					<CardTitle className="text-base">Request details</CardTitle>
				</CardHeader>
				<CardContent>
					<form className="space-y-6" onSubmit={submit}>
						<div className="space-y-2">
							<Label htmlFor="title">Short summary</Label>
							<Input
								id="title"
								name="title"
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								minLength={3}
								maxLength={160}
								required
								placeholder="Example: I can’t connect to the office Wi-Fi"
								className="h-10 rounded-md text-sm"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="body">What’s happening?</Label>
							<Textarea
								id="body"
								name="body"
								value={body}
								onChange={(event) => setBody(event.target.value)}
								minLength={10}
								maxLength={10000}
								required
								placeholder="Tell us what you expected, what happened instead, and when it started."
								className="min-h-40 rounded-md text-sm"
							/>
							<p className="text-muted-foreground text-xs">
								Please don’t include passwords or other sensitive information.
							</p>
						</div>
						<div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
							<Link
								to="/home"
								className={buttonVariants({ variant: "outline", size: "lg" })}
							>
								Cancel
							</Link>
							<Button type="submit" size="lg" disabled={createTicket.isPending}>
								<Send aria-hidden="true" />{" "}
								{createTicket.isPending ? "Sending…" : "Send request"}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</PageShell>
	);
}
