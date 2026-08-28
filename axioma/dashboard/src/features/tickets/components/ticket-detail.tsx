import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RouteIcon, Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	formatDate,
	PageHeader,
	PageState,
	StatusBadge,
} from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AgentTranscript } from "@/features/agent-runs/components/agent-transcript";
import { ticketMutations } from "../api/mutations";
import { ticketQueries } from "../api/queries";
import type { TicketDetail as TicketDetailData } from "../api/types";

export function TicketDetailPage({ ticketId }: { ticketId: string }) {
	const query = useQuery(ticketQueries.detail(ticketId));
	if (query.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading ticket"
				description="Retrieving ticket details…"
			/>
		);
	if (query.isError)
		return (
			<PageState
				kind="error"
				title="Ticket unavailable"
				description={query.error.message}
				onRetry={() => query.refetch()}
			/>
		);
	if (!query.data)
		return (
			<PageState
				kind="empty"
				title="Ticket not found"
				description="This ticket may have been removed or the ID is incorrect."
			/>
		);
	return <TicketDetail ticket={query.data} />;
}

function TicketDetail({ ticket }: { ticket: TicketDetailData }) {
	const queryClient = useQueryClient();
	const [route, setRoute] = useState("");
	const [resolution, setResolution] = useState("");
	const mutation = useMutation({
		...ticketMutations.update(queryClient),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tickets"] });
			toast.success("Ticket updated");
		},
		onError: (error) => toast.error(error.message),
	});
	const closed = ticket.status === "closed";
	const update = (input: Omit<Parameters<typeof mutation.mutate>[0], "id">) =>
		mutation.mutate({ id: ticket.id, ...input });

	return (
		<div className="space-y-5">
			<PageHeader
				eyebrow={`Ticket / ${ticket.id}`}
				title={ticket.title}
				description={`Reported by ${ticket.reporterName} · ${formatDate(ticket.createdAt)}`}
				actions={<StatusBadge status={ticket.status} />}
			/>
			<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
				<div className="min-w-0 space-y-5">
					<section className="rounded-xl border bg-card p-4 shadow-sm">
						<h2 className="font-semibold text-xs uppercase tracking-wider">
							Request
						</h2>
						<p className="mt-3 whitespace-pre-wrap text-sm leading-6">
							{ticket.body}
						</p>
					</section>
					<AgentTranscript runs={ticket.runs} />
				</div>
				<aside className="space-y-4">
					<section className="rounded-xl border bg-card p-4 shadow-sm">
						<h2 className="font-semibold text-xs uppercase tracking-wider">
							Metadata
						</h2>
						<dl className="mt-3 divide-y text-xs">
							<Meta label="Status">
								<StatusBadge status={ticket.status} />
							</Meta>
							<Meta label="Route">{ticket.route ?? "Unassigned"}</Meta>
							<Meta label="Device">{ticket.deviceId ?? "None linked"}</Meta>
							<Meta label="Updated">{formatDate(ticket.updatedAt)}</Meta>
							<Meta label="Resolution">{ticket.resolution ?? "Pending"}</Meta>
						</dl>
					</section>
					<section className="rounded-xl border bg-card p-4 shadow-sm">
						<h2 className="font-semibold text-xs uppercase tracking-wider">
							Operator actions
						</h2>
						<label htmlFor="ticket-route" className="mt-4 block text-xs">
							<span className="mb-1.5 block font-medium">Assignment route</span>
							<Input
								id="ticket-route"
								value={route}
								onChange={(event) => setRoute(event.target.value)}
								placeholder="endpoint-ops / @alex"
								disabled={mutation.isPending || closed}
							/>
						</label>
						<div className="mt-2 grid grid-cols-2 gap-2">
							<Button
								variant="outline"
								disabled={!route.trim() || mutation.isPending || closed}
								onClick={() =>
									update({ action: "escalate", route: route.trim() })
								}
							>
								<RouteIcon /> Reassign
							</Button>
							<Button
								variant="outline"
								disabled={mutation.isPending || closed}
								onClick={() =>
									update({
										action: "escalate",
										route: route.trim() || "IT takeover",
									})
								}
							>
								<Wrench /> Take over
							</Button>
						</div>
						<Button
							className="mt-2 w-full"
							variant="destructive"
							disabled={mutation.isPending || closed}
							onClick={() =>
								update({ action: "escalate", route: route.trim() || undefined })
							}
						>
							<AlertTriangle /> Escalate
						</Button>
						<label htmlFor="ticket-resolution" className="mt-5 block text-xs">
							<span className="mb-1.5 block font-medium">Resolution</span>
							<Textarea
								id="ticket-resolution"
								value={resolution}
								onChange={(event) => setResolution(event.target.value)}
								placeholder="Summarize outcome and evidence…"
								disabled={mutation.isPending || closed}
							/>
						</label>
						<Button
							className="mt-2 w-full"
							disabled={mutation.isPending || closed}
							onClick={() =>
								update({
									action: "close",
									resolution: resolution.trim() || undefined,
								})
							}
						>
							<CheckCircle2 /> {closed ? "Closed" : "Close ticket"}
						</Button>
					</section>
				</aside>
			</div>
		</div>
	);
}

function Meta({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="grid grid-cols-[90px_1fr] gap-3 py-2.5 first:pt-0 last:pb-0">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="min-w-0 break-words text-right">{children}</dd>
		</div>
	);
}
