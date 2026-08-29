import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CircleDot, Monitor, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	ErrorState,
	formatDate,
	getStatus,
	PageShell,
	StatusBadge,
} from "@/components/ticket-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { updateMyTicketMutationOptions } from "@/features/tickets/api/mutations";
import { myTicketQueryOptions } from "@/features/tickets/api/queries";
import { ProgressTimeline } from "@/features/tickets/components/progress-timeline";
import { ResolutionCard } from "@/features/tickets/components/resolution-card";

export const Route = createFileRoute("/_auth/tickets/$ticketId")({
	component: RouteComponent,
	head: () => ({ meta: [{ title: "Request details · Axioma" }] }),
});

function RouteComponent() {
	const { ticketId } = Route.useParams();
	const [detailHelpOpen, setDetailHelpOpen] = useState(false);
	const [detailNote, setDetailNote] = useState("");
	const ticket = useQuery(myTicketQueryOptions(ticketId));
	const updateTicket = useMutation({
		...updateMyTicketMutationOptions(),
		onSuccess: async (...args) => {
			await updateMyTicketMutationOptions().onSuccess?.(...args);
			toast.success("Request updated");
		},
		onError: () =>
			toast.error("We couldn’t update this request. Please try again."),
	});

	if (ticket.isPending) {
		return (
			<PageShell>
				<Skeleton className="mb-8 h-8 w-36 rounded-md" />
				<div className="space-y-4" role="status" aria-label="Loading request">
					<Skeleton className="h-32 w-full rounded-xl" />
					<Skeleton className="h-64 w-full rounded-xl" />
				</div>
			</PageShell>
		);
	}

	if (ticket.isError) {
		return (
			<PageShell>
				<ErrorState retry={() => ticket.refetch()} />
			</PageShell>
		);
	}

	if (!ticket.data) {
		return (
			<PageShell>
				<Card className="rounded-xl">
					<Empty>
						<EmptyHeader>
							<EmptyTitle>Request not found</EmptyTitle>
							<EmptyDescription>
								This request may have been removed or may not belong to your
								account.
							</EmptyDescription>
						</EmptyHeader>
						<Link to="/home" className={buttonVariants()}>
							Back to requests
						</Link>
					</Empty>
				</Card>
			</PageShell>
		);
	}

	const data = ticket.data;
	const progress = getStatus(data.status);
	const active =
		data.status === "open" ||
		data.status === "routing" ||
		data.status === "resolving";

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

			<header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
				<div className="min-w-0 max-w-3xl">
					<div className="mb-3 flex flex-wrap items-center gap-3">
						<StatusBadge status={data.status} />
						<span className="text-muted-foreground text-xs">
							Opened {formatDate(data.createdAt)}
						</span>
					</div>
					<h1 className="wrap-break-word font-semibold text-2xl tracking-tight sm:text-4xl">
						{data.title}
					</h1>
					<p className="mt-3 text-muted-foreground text-sm">
						Request #{data.id.slice(0, 8)}
					</p>
				</div>
				{active ? (
					<Button
						variant="outline"
						className="w-full sm:w-auto"
						onClick={() => setDetailHelpOpen(true)}
					>
						<Plus aria-hidden="true" /> Add more detail
					</Button>
				) : null}
			</header>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
				<div className="min-w-0 space-y-6">
					<Card className="rounded-xl">
						<CardContent>
							<ProgressTimeline
								status={data.status}
								progressMarker={data.progressMarker}
							/>
						</CardContent>
					</Card>

					<Card id="shared-details" className="rounded-xl">
						<CardHeader className="border-b">
							<CardTitle>What you shared</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="whitespace-pre-wrap text-sm leading-7">
								{data.body}
							</p>
						</CardContent>
					</Card>

					<ResolutionCard
						ticket={data}
						pending={updateTicket.isPending}
						onAction={(input) => updateTicket.mutate(input)}
					/>
				</div>

				<aside className="space-y-4" aria-label="Request information">
					<Card className="rounded-xl">
						<CardHeader className="border-b">
							<CardTitle>Request information</CardTitle>
						</CardHeader>
						<CardContent className="space-y-5">
							<div className="flex gap-3">
								<CircleDot
									className="mt-0.5 size-4 text-muted-foreground"
									aria-hidden="true"
								/>
								<div>
									<p className="text-muted-foreground text-xs">Status</p>
									<p className="mt-1 font-medium text-sm">{progress.label}</p>
								</div>
							</div>
							{data.deviceId ? (
								<div className="flex gap-3">
									<Monitor
										className="mt-0.5 size-4 text-muted-foreground"
										aria-hidden="true"
									/>
									<div>
										<p className="text-muted-foreground text-xs">
											Device attached
										</p>
										<p className="mt-1 font-medium text-sm">Yes</p>
									</div>
								</div>
							) : null}
							<div>
								<p className="text-muted-foreground text-xs">Last updated</p>
								<p className="mt-1 font-medium text-sm">
									{formatDate(data.updatedAt)}
								</p>
							</div>
						</CardContent>
					</Card>
				</aside>
			</div>

			<Dialog open={detailHelpOpen} onOpenChange={setDetailHelpOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add more detail</DialogTitle>
						<DialogDescription>
							Share anything else that could help with this request.
						</DialogDescription>
					</DialogHeader>
					<label htmlFor="detail-note" className="font-medium text-sm">
						Additional detail
					</label>
					<Textarea
						id="detail-note"
						required
						maxLength={2_000}
						value={detailNote}
						onChange={(event) => setDetailNote(event.target.value)}
						placeholder="Add a short note"
						className="min-h-24 rounded-md text-sm"
					/>
					<DialogFooter>
						<Button
							disabled={updateTicket.isPending || !detailNote.trim()}
							onClick={() =>
								updateTicket.mutate(
									{
										id: data.id,
										action: "add_detail",
										note: detailNote.trim(),
									},
									{
										onSuccess: () => {
											setDetailNote("");
											setDetailHelpOpen(false);
										},
									},
								)
							}
						>
							Add detail
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageShell>
	);
}
