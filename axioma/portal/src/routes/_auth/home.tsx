import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CircleCheck, Inbox, Plus } from "lucide-react";
import {
	ErrorState,
	formatDate,
	LoadingCards,
	PageHeading,
	PageShell,
	StatusBadge,
} from "@/components/ticket-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTicketStage, isFinishedTicket } from "@/features/tickets/copy";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/home")({
	component: RouteComponent,
	head: () => ({ meta: [{ title: "My requests · Axioma" }] }),
});

function RouteComponent() {
	const { session } = Route.useRouteContext();
	const tickets = useQuery(
		orpc.listTickets.queryOptions({ input: { scope: "mine" } }),
	);
	const firstName = session.data?.user.name?.split(" ")[0];
	const items = tickets.data?.items ?? [];
	const enroll = useMutation(
		orpc.enrollDevice.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: orpc.listMyDevices.key() }),
		}),
	);
	const enrollmentForm = useForm({
		defaultValues: { code: "" },
		onSubmit: ({ value }) => enroll.mutateAsync({ code: value.code.trim() }),
		validators: {
			onSubmit: ({ value }) =>
				value.code.trim().length >= 4
					? undefined
					: "Enter the code shown on your computer.",
		},
	});
	const activeTickets = items.filter(
		(ticket) => !isFinishedTicket(ticket.status),
	);
	const finishedTickets = items.filter((ticket) =>
		isFinishedTicket(ticket.status),
	);
	const ticketCard = (ticket: (typeof items)[number]) => (
		<Link
			key={ticket.id}
			to="/tickets/$ticketId"
			params={{ ticketId: ticket.id }}
			className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<Card className="rounded-xl transition-colors group-hover:bg-muted/40">
				<CardContent className="flex items-center justify-between gap-4 py-1 sm:gap-5">
					<div className="min-w-0">
						<div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-3">
							<StatusBadge status={ticket.status} />
							<span className="font-medium text-muted-foreground text-xs">
								Stage: {getTicketStage(ticket.status)}
							</span>
							{ticket.status === "resolved" ? (
								<span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
									<CircleCheck className="size-3.5" aria-hidden="true" />
									<span>Resolution ready</span>
								</span>
							) : null}
							<span className="text-muted-foreground text-xs">
								Updated {formatDate(ticket.updatedAt)}
							</span>
						</div>
						<h3 className="truncate font-semibold text-base">{ticket.title}</h3>
						<p className="mt-1 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
							{ticket.body}
						</p>
					</div>
					<ArrowRight
						className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
						aria-hidden="true"
					/>
				</CardContent>
			</Card>
		</Link>
	);

	return (
		<PageShell>
			<PageHeading
				eyebrow="Employee support"
				title={
					firstName ? `Good to see you, ${firstName}` : "Your support requests"
				}
				description="Ask for help, see what’s happening, and return to your work with confidence."
				action={
					<Link to="/tickets/new" className={buttonVariants({ size: "lg" })}>
						<Plus aria-hidden="true" /> New request
					</Link>
				}
			/>

			<details className="mb-6 rounded-xl border bg-card">
				<summary className="cursor-pointer rounded-xl px-4 py-3 font-medium outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring sm:px-6">
					Connect a computer
				</summary>
				<form
					className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-end sm:p-6"
					onSubmit={(event) => {
						event.preventDefault();
						enrollmentForm.handleSubmit();
					}}
				>
					<enrollmentForm.Field name="code">
						{(field) => (
							<div className="min-w-0 flex-1 space-y-2">
								<Label htmlFor="enrollment-code">Code shown by axel-cli</Label>
								<Input
									id="enrollment-code"
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									maxLength={64}
									placeholder="ABCDEF-1234"
								/>
								{field.state.meta.errors.length ? (
									<p className="text-destructive text-sm" role="alert">
										{field.state.meta.errors.map(String).join(", ")}
									</p>
								) : null}
							</div>
						)}
					</enrollmentForm.Field>
					<Button type="submit" disabled={enroll.isPending}>
						{enroll.isPending ? "Connecting…" : "Connect computer"}
					</Button>
				</form>
				{enroll.isError ? (
					<p className="px-4 pb-4 text-destructive text-sm" role="alert">
						We couldn’t use that code. Check it and try again.
					</p>
				) : null}
				{enroll.isSuccess ? (
					<p className="px-4 pb-4 text-sm" role="status">
						Computer connected.
					</p>
				) : null}
			</details>

			<div className="mb-4 flex items-center justify-between">
				<h2 className="font-semibold text-lg">Your requests</h2>
				{items.length ? (
					<p className="text-muted-foreground text-sm">
						{items.length} {items.length === 1 ? "request" : "requests"}
					</p>
				) : null}
			</div>

			{tickets.isPending ? <LoadingCards /> : null}
			{tickets.isError ? <ErrorState retry={() => tickets.refetch()} /> : null}
			{tickets.data && items.length === 0 ? (
				<Card className="rounded-xl border-dashed bg-transparent">
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Inbox aria-hidden="true" />
							</EmptyMedia>
							<EmptyTitle>No requests yet</EmptyTitle>
							<EmptyDescription>
								When something gets in the way of your work, start here. We’ll
								keep every update in one place.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Link to="/tickets/new" className={buttonVariants()}>
								Create your first request
							</Link>
						</EmptyContent>
					</Empty>
				</Card>
			) : null}
			{activeTickets?.length ? (
				<section aria-labelledby="active-requests-heading">
					<h3 id="active-requests-heading" className="sr-only">
						Active requests
					</h3>
					<div className="grid gap-4">{activeTickets.map(ticketCard)}</div>
				</section>
			) : null}
			{finishedTickets?.length ? (
				<details className="group/finished mt-6 rounded-xl border bg-card">
					<summary className="cursor-pointer rounded-xl px-4 py-4 font-semibold outline-none marker:text-muted-foreground hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring sm:px-6">
						Finished requests ({finishedTickets.length})
					</summary>
					<div className="grid gap-4 border-t p-4 sm:p-6">
						{finishedTickets.map(ticketCard)}
					</div>
				</details>
			) : null}
		</PageShell>
	);
}
