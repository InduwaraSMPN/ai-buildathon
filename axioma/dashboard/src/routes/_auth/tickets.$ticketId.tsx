import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	Circle,
	Clock3,
	RouteIcon,
	Wrench,
} from "lucide-react";
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
import { client, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/tickets/$ticketId")({
	component: TicketDetail,
});

function TicketDetail() {
	const { ticketId } = Route.useParams();
	const queryClient = useQueryClient();
	const query = useQuery(
		orpc.getTicket.queryOptions({ input: { id: ticketId } }),
	);
	const [route, setRoute] = useState("");
	const [resolution, setResolution] = useState("");
	const mutation = useMutation({
		mutationFn: (input: {
			action: "close" | "escalate";
			route?: string;
			resolution?: string;
		}) => client.updateTicket({ id: ticketId, ...input }),
		onSuccess: () => {
			toast.success("Ticket updated");
			queryClient.invalidateQueries();
		},
		onError: (error) => toast.error(error.message),
	});
	const ticket = query.data;
	if (query.isPending)
		return (
			<div className="mx-auto w-full max-w-[1600px] p-6">
				<PageState
					kind="loading"
					title="Loading ticket"
					description="Retrieving transcript and metadata…"
				/>
			</div>
		);
	if (query.isError)
		return (
			<div className="mx-auto w-full max-w-[1600px] p-6">
				<PageState
					kind="error"
					title="Ticket unavailable"
					description={query.error.message}
					onRetry={() => query.refetch()}
				/>
			</div>
		);
	if (!ticket)
		return (
			<div className="mx-auto w-full max-w-[1600px] p-6">
				<PageState
					kind="empty"
					title="Ticket not found"
					description="This ticket may have been removed or the ID is incorrect."
				/>
			</div>
		);
	const steps = ticket.runs
		.flatMap((run) => run.steps.map((step) => ({ ...step, run })))
		.sort(
			(a, b) =>
				a.createdAt.getTime() - b.createdAt.getTime() || a.ordinal - b.ordinal,
		);
	const closed = ticket.status === "closed";

	return (
		<div className="mx-auto w-full max-w-[1600px] p-4 lg:p-6">
			<Link
				to="/home"
				className="mb-4 inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
			>
				<ArrowLeft className="size-3.5" /> Back to queue
			</Link>
			<PageHeader
				eyebrow={`Ticket / ${ticket.id}`}
				title={ticket.title}
				description={`Reported by ${ticket.reporterName} · ${formatDate(ticket.createdAt)}`}
				actions={<StatusBadge status={ticket.status} />}
			/>
			<div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
				<div className="min-w-0 space-y-5">
					<section className="rounded-xl border bg-card p-4 shadow-sm">
						<h2 className="font-semibold text-xs uppercase tracking-wider">
							Request
						</h2>
						<p className="mt-3 whitespace-pre-wrap text-sm leading-6">
							{ticket.body}
						</p>
					</section>
					<section aria-labelledby="transcript-heading">
						<div className="mb-3 flex items-center justify-between">
							<div>
								<h2 id="transcript-heading" className="font-semibold text-sm">
									Ordered agent transcript
								</h2>
								<p className="text-muted-foreground text-xs">
									{ticket.runs.length} runs · {steps.length} steps
								</p>
							</div>
						</div>
						{steps.length === 0 ? (
							<PageState
								kind="empty"
								title="No agent activity"
								description="The agent has not produced transcript steps for this ticket."
							/>
						) : (
							<ol className="overflow-hidden rounded-xl border bg-card shadow-sm">
								{steps.map((step, index) => (
									<li
										key={step.id}
										className="grid grid-cols-[42px_1fr] border-b last:border-b-0"
									>
										<div className="flex flex-col items-center border-r bg-muted/30 py-4">
											<span className="grid size-5 place-items-center bg-foreground font-mono text-[9px] text-background">
												{index + 1}
											</span>
											<span className="mt-2 h-full w-px bg-border" />
										</div>
										<article className="min-w-0 p-4">
											<div className="flex flex-wrap items-center gap-2">
												<StepIcon
													kind={step.kind}
													error={Boolean(step.error)}
												/>
												<span className="font-medium text-xs uppercase tracking-wider">
													{step.kind}
												</span>
												{step.toolName && (
													<span className="border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
														{step.toolName}
													</span>
												)}
												<span className="ml-auto text-[10px] text-muted-foreground">
													{formatDate(step.createdAt)}
												</span>
											</div>
											{step.reasoning && (
												<Block
													title="Reasoning / evidence"
													value={step.reasoning}
												/>
											)}
											{step.toolInput != null && (
												<Block title="Tool input" value={step.toolInput} code />
											)}
											{step.toolOutput != null && (
												<Block
													title="Tool output"
													value={step.toolOutput}
													code
												/>
											)}
											{step.error && (
												<Block title="Error" value={step.error} error />
											)}
										</article>
									</li>
								))}
							</ol>
						)}
					</section>
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
							Operator controls
						</h2>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Takeover and reassignment escalate this ticket to the selected
							route.
						</p>
						<label htmlFor="assignment-route" className="mt-4 block text-xs">
							<span className="mb-1.5 block font-medium">Assignment route</span>
							<Input
								id="assignment-route"
								value={route}
								onChange={(event) => setRoute(event.target.value)}
								placeholder="e.g. endpoint-ops / @alex"
								disabled={mutation.isPending || closed}
							/>
						</label>
						<div className="mt-2 grid grid-cols-2 gap-2">
							<Button
								variant="outline"
								disabled={!route.trim() || mutation.isPending || closed}
								onClick={() =>
									mutation.mutate({ action: "escalate", route: route.trim() })
								}
							>
								<RouteIcon /> Reassign
							</Button>
							<Button
								variant="outline"
								disabled={mutation.isPending || closed}
								onClick={() =>
									mutation.mutate({
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
								mutation.mutate({
									action: "escalate",
									route: route.trim() || undefined,
								})
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
								mutation.mutate({
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

function Block({
	title,
	value,
	code,
	error,
}: {
	title: string;
	value: unknown;
	code?: boolean;
	error?: boolean;
}) {
	const text =
		typeof value === "string" ? value : JSON.stringify(value, null, 2);
	return (
		<div
			className={
				error
					? "mt-3 border border-destructive/30 bg-destructive/5 p-3"
					: "mt-3 border bg-muted/30 p-3"
			}
		>
			<p
				className={
					error
						? "mb-1.5 font-medium text-[10px] text-destructive uppercase tracking-wider"
						: "mb-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider"
				}
			>
				{title}
			</p>
			<pre
				className={
					code
						? "overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5"
						: "whitespace-pre-wrap font-sans text-xs leading-5"
				}
			>
				{text}
			</pre>
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
function StepIcon({ kind, error }: { kind: string; error: boolean }) {
	if (error) return <AlertTriangle className="size-4 text-destructive" />;
	if (kind.toLowerCase().includes("tool"))
		return <Wrench className="size-4 text-violet-500" />;
	if (kind.toLowerCase().includes("complete"))
		return <CheckCircle2 className="size-4 text-emerald-500" />;
	if (kind.toLowerCase().includes("wait"))
		return <Clock3 className="size-4 text-amber-500" />;
	return <Circle className="size-4 text-sky-500" />;
}
