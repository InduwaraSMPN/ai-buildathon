import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { env } from "@/env";
import { updateMyTicketMutationOptions } from "@/features/tickets/api/mutations";
import { myTicketQueryOptions } from "@/features/tickets/api/queries";
import {
	ConversationCard,
	CsatCard,
} from "@/features/tickets/components/conversation-card";
import { ProgressTimeline } from "@/features/tickets/components/progress-timeline";
import { ResolutionCard } from "@/features/tickets/components/resolution-card";
import { approvalStatusCopy, attachmentCopy } from "@/features/tickets/copy";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/tickets/$ticketId")({
	component: RouteComponent,
	head: () => ({ meta: [{ title: "Request details · Axioma" }] }),
});

function RouteComponent() {
	const { ticketId } = Route.useParams();
	const queryClient = useQueryClient();
	const [detailHelpOpen, setDetailHelpOpen] = useState(false);
	const [detailNote, setDetailNote] = useState("");
	const ticket = useQuery(myTicketQueryOptions(ticketId));
	const approval = useQuery(
		orpc.getMyApprovalStatus.queryOptions({ input: { ticketId } }),
	);
	const documentInput = { targetType: "ticket" as const, targetId: ticketId };
	const documents = useQuery(
		orpc.listDocuments.queryOptions({ input: documentInput }),
	);
	const addLink = useMutation(
		orpc.createLinkDocument.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: orpc.listDocuments.key({ input: documentInput }),
				}),
			onError: (error) => toast.error(error.message),
		}),
	);
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
	const approvalCopy = approval.data
		? approvalStatusCopy[approval.data.status]
		: undefined;
	const active =
		data.status === "open" ||
		data.status === "routing" ||
		data.status === "resolving" ||
		data.status === "pending";

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
						<StatusBadge status={data.status} label={data.statusLabel} />
						<span className="text-muted-foreground text-xs">
							Opened {formatDate(data.createdAt)}
						</span>
					</div>
					<h1 className="wrap-break-word font-semibold text-2xl tracking-tight sm:text-4xl">
						{data.title}
					</h1>
					<p className="mt-3 font-mono text-muted-foreground text-sm">
						Request {data.number ?? data.id}
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

					<ConversationCard ticketId={data.id} messages={data.messages} />

					<ResolutionCard
						ticket={data}
						pending={updateTicket.isPending}
						onAction={(input) => updateTicket.mutate(input)}
					/>
					{data.status === "closed" && data.csat ? (
						<CsatCard csat={data.csat} />
					) : null}
				</div>

				<aside className="space-y-4" aria-label="Request information">
					{approvalCopy ? (
						<Card className="rounded-xl">
							<CardHeader className="border-b">
								<CardTitle>Approval</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="font-medium text-sm">{approvalCopy.label}</p>
								<p className="mt-1 text-muted-foreground text-sm">
									{approvalCopy.detail}
								</p>
							</CardContent>
						</Card>
					) : null}
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
					<Card className="rounded-xl">
						<CardHeader className="border-b">
							<CardTitle>{attachmentCopy.title}</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{documents.isPending ? (
								<p role="status" className="text-muted-foreground text-sm">
									{attachmentCopy.loading}
								</p>
							) : documents.isError ? (
								<button
									type="button"
									className="text-destructive text-sm underline"
									onClick={() => documents.refetch()}
								>
									{attachmentCopy.loadError}
								</button>
							) : documents.data.length ? (
								documents.data.map((item) => (
									<a
										key={item.id}
										className="block text-sm underline underline-offset-4"
										href={
											item.kind === "link"
												? item.url
												: new URL(
														item.downloadUrl,
														`${env.VITE_SERVER_URL.replace(/\/$/, "")}/`,
													).toString()
										}
									>
										{item.displayName}
									</a>
								))
							) : (
								<p className="text-muted-foreground text-sm">
									{attachmentCopy.empty}
								</p>
							)}
							<div className="flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={addLink.isPending}
									onClick={() => {
										const url = window.prompt(attachmentCopy.linkUrlPrompt);
										if (!url) return;
										addLink.mutate({
											...documentInput,
											url,
											displayName:
												window.prompt(attachmentCopy.linkNamePrompt, url) ??
												url,
										});
									}}
								>
									{attachmentCopy.addLink}
								</Button>
								<label className="inline-flex cursor-pointer items-center rounded-md border px-3 text-sm">
									<input
										className="sr-only"
										type="file"
										multiple
										onChange={async (event) => {
											try {
												for (const file of event.target.files ?? []) {
													const body = new FormData();
													body.set("file", file);
													body.set("targetType", "ticket");
													body.set("targetId", ticketId);
													const response = await fetch(
														new URL(
															"api/documents",
															`${env.VITE_SERVER_URL.replace(/\/$/, "")}/`,
														),
														{ method: "POST", body, credentials: "include" },
													);
													if (!response.ok)
														throw new Error(await response.text());
												}
												await queryClient.invalidateQueries({
													queryKey: orpc.listDocuments.key({
														input: documentInput,
													}),
												});
												toast.success(attachmentCopy.uploaded);
											} catch {
												toast.error(attachmentCopy.uploadFailed);
											}
										}}
									/>
									{attachmentCopy.attachFiles}
								</label>
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
