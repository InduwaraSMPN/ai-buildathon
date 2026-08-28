import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, CircleDot, Monitor, RefreshCw } from "lucide-react";
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
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/tickets/$ticketId")({
	component: RouteComponent,
	head: () => ({ meta: [{ title: "Request details · Axioma" }] }),
});

function RouteComponent() {
	const { ticketId } = Route.useParams();
	const ticket = useQuery(
		orpc.getTicket.queryOptions({ input: { id: ticketId } }),
	);
	const updateTicket = useMutation(
		orpc.updateTicket.mutationOptions({
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({ queryKey: orpc.getTicket.key() }),
					queryClient.invalidateQueries({ queryKey: orpc.listTickets.key() }),
				]);
				toast.success("Request updated");
			},
			onError: () =>
				toast.error("We couldn’t update this request. Please try again."),
		}),
	);

	if (ticket.isPending) {
		return (
			<PageShell>
				<Skeleton className="mb-8 h-8 w-36 rounded-md" />
				<div className="space-y-4">
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
	const ProgressIcon = progress.icon;
	const complete = data.status === "resolved" || data.status === "closed";

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
			<div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
				<div className="max-w-3xl">
					<div className="mb-3 flex flex-wrap items-center gap-3">
						<StatusBadge status={data.status} />
						<span className="text-muted-foreground text-xs">
							Opened {formatDate(data.createdAt)}
						</span>
					</div>
					<h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">
						{data.title}
					</h1>
					<p className="mt-3 text-muted-foreground text-sm">
						Request #{data.id.slice(0, 8)}
					</p>
				</div>
				{!complete ? (
					<Button
						variant="outline"
						disabled={updateTicket.isPending}
						onClick={() =>
							updateTicket.mutate({ id: data.id, action: "escalate" })
						}
					>
						<RefreshCw aria-hidden="true" /> I still need help
					</Button>
				) : null}
			</div>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
				<div className="space-y-6">
					<Card className="rounded-xl border-blue-500/20 bg-blue-500/5">
						<CardContent className="flex gap-4 py-2">
							<div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300">
								<ProgressIcon className="size-5" aria-hidden="true" />
							</div>
							<div>
								<p className="font-semibold text-base">{progress.label}</p>
								<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
									{progress.detail}
								</p>
								<p className="mt-3 text-muted-foreground text-xs">
									Last updated {formatDate(data.updatedAt)}
								</p>
							</div>
						</CardContent>
					</Card>

					<Card className="rounded-xl">
						<CardHeader className="border-b">
							<CardTitle className="text-base">What you shared</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="whitespace-pre-wrap text-sm leading-7">
								{data.body}
							</p>
						</CardContent>
					</Card>

					{data.resolution ? (
						<Card className="rounded-xl border-emerald-500/20 bg-emerald-500/5">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<Check
										className="size-5 text-emerald-600"
										aria-hidden="true"
									/>{" "}
									Your solution
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="whitespace-pre-wrap text-sm leading-7">
									{data.resolution}
								</p>
								{data.status !== "closed" ? (
									<div className="mt-6 flex flex-wrap gap-3 border-t pt-5">
										<Button
											disabled={updateTicket.isPending}
											onClick={() =>
												updateTicket.mutate({ id: data.id, action: "close" })
											}
										>
											<Check aria-hidden="true" /> This solved it
										</Button>
										<Button
											variant="outline"
											disabled={updateTicket.isPending}
											onClick={() =>
												updateTicket.mutate({ id: data.id, action: "escalate" })
											}
										>
											I still need help
										</Button>
									</div>
								) : null}
							</CardContent>
						</Card>
					) : null}
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
		</PageShell>
	);
}
