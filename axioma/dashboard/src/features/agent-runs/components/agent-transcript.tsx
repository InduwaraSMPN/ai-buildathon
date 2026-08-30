import {
	RiErrorWarningLine as AlertTriangle,
	RiFileCopyLine as Copy,
	RiInbox2Line as Inbox,
	RiPlayLine as Play,
	RiRestartLine as RotateCcw,
	RiStopLine as Square,
} from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageState, StatusBadge } from "@/components/support-ui";
import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import type { TicketDetail, TicketStatus } from "@/features/tickets/api/types";
import { invalidateTicketQueries } from "@/features/tickets/query-behavior";
import { orpc } from "@/utils/orpc";
import type { AgentRun } from "../api/types";
import { type EscalationDetails, extractEscalationDetails } from "./escalation";
import { runRefetchInterval } from "./run-polling";
import { RunSelector } from "./run-selector";
import { StepCard } from "./step-card";

export function AgentTranscript({
	runs,
	ticketId,
	status,
	escalationFlag,
}: {
	runs: AgentRun[];
	ticketId: string;
	status: TicketStatus;
	escalationFlag?: TicketDetail["escalationFlag"];
}) {
	const queryClient = useQueryClient();
	const ticketQuery = useQuery(
		orpc.getTicket.queryOptions({ input: { id: ticketId } }),
	);
	const ticketEscalationFlag =
		escalationFlag ?? ticketQuery.data?.escalationFlag ?? "none";
	const [selectedId, setSelectedId] = useState<string>();
	const listedRun = runs.find((run) => run.id === selectedId) ?? runs[0];
	const queriedId = selectedId ?? listedRun?.id ?? "";
	const runQuery = useQuery({
		...orpc.getRun.queryOptions({
			input: { id: queriedId },
			refetchInterval: runRefetchInterval,
			refetchIntervalInBackground: false,
		}),
		enabled: Boolean(queriedId),
	});
	const selectedRun = runQuery.data ?? listedRun;
	const queriedStatus = runQuery.data?.status;
	useEffect(() => {
		if (
			queriedStatus &&
			queriedStatus !== "running" &&
			listedRun?.status === "running"
		)
			void queryClient.invalidateQueries({
				queryKey: orpc.getTicket.key({ input: { id: ticketId } }),
			});
	}, [listedRun?.status, queriedStatus, queryClient, ticketId]);
	const selectorRuns = selectedRun
		? runs.some((run) => run.id === selectedRun.id)
			? runs.map((run) => (run.id === selectedRun.id ? selectedRun : run))
			: [selectedRun, ...runs]
		: runs;
	const startMutation = useMutation(
		orpc.startRun.mutationOptions({
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({ queryKey: orpc.getRun.key() }),
					invalidateTicketQueries(queryClient, orpc, ticketId),
				]);
			},
		}),
	);
	const cancelMutation = useMutation(
		orpc.cancelRun.mutationOptions({
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({ queryKey: orpc.getRun.key() }),
					invalidateTicketQueries(queryClient, orpc, ticketId),
				]);
			},
		}),
	);

	const startRun = async () => {
		try {
			const run = await startMutation.mutateAsync({ ticketId });
			setSelectedId(run.id);
			toast.success("Agent run started");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Could not start run",
			);
		}
	};
	const cancel = async () => {
		if (!selectedRun) return;
		try {
			await cancelMutation.mutateAsync({
				id: selectedRun.id,
				reason: "Taken over by dashboard operator",
			});
			toast.success("Agent run stopped for operator takeover");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Could not cancel run",
			);
		}
	};

	if (runQuery.isPending && queriedId && !selectedRun)
		return (
			<PageState
				kind="loading"
				title="Loading agent run"
				description="Retrieving the selected transcript and metrics…"
			/>
		);
	if (runQuery.isError && runQuery.data === undefined && !selectedRun)
		return (
			<PageState
				kind="error"
				title="Could not load agent run"
				description="The selected run may have changed. Retry to load its latest transcript and metrics."
				onRetry={() => runQuery.refetch()}
			/>
		);
	if (!selectedRun)
		return (
			<Empty className="min-h-64 border" role="status">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Inbox />
					</EmptyMedia>
					<EmptyTitle>No agent activity</EmptyTitle>
					<EmptyDescription>No run attempts are available.</EmptyDescription>
				</EmptyHeader>
				{status === "open" && (
					<Button disabled={startMutation.isPending} onClick={startRun}>
						<Play data-icon="inline-start" aria-hidden="true" />
						{startMutation.isPending ? "Starting…" : "Start agent run"}
					</Button>
				)}
			</Empty>
		);

	const steps = selectedRun.steps.toSorted((a, b) => a.ordinal - b.ordinal);
	const escalation = extractEscalationDetails(selectedRun);
	const latestRun = selectorRuns[0];
	const canRerun =
		status === "escalated" &&
		selectedRun.id === latestRun?.id &&
		(selectedRun.status === "failed" || selectedRun.status === "exhausted");

	return (
		<section aria-labelledby="agent-transcript-heading">
			<div className="mb-3 flex items-end justify-between gap-3">
				<div>
					<h2 id="agent-transcript-heading" className="font-semibold text-sm">
						Agent transcript
					</h2>
					<p className="text-muted-foreground text-xs">
						{runs.length} {runs.length === 1 ? "attempt" : "attempts"}; select
						one to inspect
					</p>
				</div>
				<div className="flex items-center gap-2">
					{canRerun && (
						<Button
							size="sm"
							variant="outline"
							disabled={startMutation.isPending}
							onClick={startRun}
						>
							<RotateCcw data-icon="inline-start" aria-hidden="true" />
							{startMutation.isPending ? "Starting…" : "Rerun"}
						</Button>
					)}
					{selectedRun.status === "running" && (
						<TakeoverButton
							pending={cancelMutation.isPending}
							onConfirm={cancel}
						/>
					)}
					<StatusBadge status={selectedRun.status} />
				</div>
			</div>
			<RunSelector
				runs={selectorRuns}
				selectedId={selectedRun.id}
				onSelect={setSelectedId}
			/>
			<p className="sr-only" aria-live="polite" aria-atomic="true">
				Selected run {selectedRun.id}, {selectedRun.status}, {steps.length}{" "}
				steps.
			</p>
			{(selectedRun.status === "escalated" || escalation) && (
				<EscalationProposal details={escalation} />
			)}
			{ticketEscalationFlag !== "none" && (
				<TicketEscalationAlert escalationFlag={ticketEscalationFlag} />
			)}
			{steps.length ? (
				<ol className="mt-3 overflow-hidden border bg-card">
					{steps.map((step, index) => (
						<StepCard key={step.id} step={step} number={index + 1} />
					))}
				</ol>
			) : (
				<Empty className="mt-3 border" role="status">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Inbox />
						</EmptyMedia>
						<EmptyTitle>No transcript steps</EmptyTitle>
						<EmptyDescription>
							This run has no transcript steps yet.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
		</section>
	);
}

function TakeoverButton({
	pending,
	onConfirm,
}: {
	pending: boolean;
	onConfirm: () => void;
}) {
	const [open, setOpen] = useState(false);
	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger
				render={<Button size="sm" variant="destructive" disabled={pending} />}
			>
				<Square aria-hidden="true" /> {pending ? "Taking over…" : "Take over"}
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Take over this agent run?</AlertDialogTitle>
					<AlertDialogDescription>
						The agent will stop after its current operation so you can continue
						handling the ticket manually.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Keep agent running</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={() => {
							setOpen(false);
							onConfirm();
						}}
					>
						Take over
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function TicketEscalationAlert({
	escalationFlag,
}: {
	escalationFlag: Exclude<TicketDetail["escalationFlag"], "none">;
}) {
	const breached = escalationFlag === "breach";
	return (
		<Alert
			variant={breached ? "destructive" : "default"}
			className={breached ? "mt-3" : "mt-3 border-warning/40 bg-warning/10"}
		>
			<AlertTriangle aria-hidden="true" />
			<AlertTitle>
				{breached ? "Ticket escalation breached" : "Ticket escalation warning"}
			</AlertTitle>
			<AlertDescription>
				This ticket's escalation flag is {escalationFlag}.
			</AlertDescription>
		</Alert>
	);
}

function EscalationProposal({
	details,
}: {
	details: EscalationDetails | null;
}) {
	const patch = details?.patchLines.join("\n") ?? "";
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(patch);
			toast.success("Proposed patch copied");
		} catch {
			toast.error("Could not copy proposed patch");
		}
	};

	return (
		<Alert className="mt-3 border-warning/40 bg-warning/10">
			<AlertTriangle aria-hidden="true" />
			<AlertTitle>Scheduler capacity escalation</AlertTitle>
			<AlertDescription>
				<p className="text-[10px] text-warning uppercase tracking-wider">
					Escalated run
				</p>
				{details?.schedulerMessage && (
					<div className="mt-3">
						<p className="mb-1.5 font-medium text-[10px] uppercase tracking-wider">
							Scheduler message — quoted verbatim
						</p>
						<blockquote className="border-warning border-l-2 pl-3 text-foreground text-xs leading-5">
							“{details.schedulerMessage}”
						</blockquote>
					</div>
				)}
				{patch && details && (
					<div className="mt-3">
						<p className="mb-1.5 font-medium text-[10px] uppercase tracking-wider">
							Proposed patch
						</p>
						<pre className="overflow-x-auto whitespace-pre-wrap break-words border bg-background p-3 font-mono text-xs leading-5">
							{details.patchLines.map((line, index) => (
								<span
									// biome-ignore lint/suspicious/noArrayIndexKey: diff lines can repeat.
									key={`${index}-${line}`}
									className={
										line.startsWith("+")
											? "block text-success"
											: line.startsWith("-")
												? "block text-destructive"
												: "block text-muted-foreground"
									}
								>
									{line}
								</span>
							))}
						</pre>
					</div>
				)}
			</AlertDescription>
			{patch && (
				<AlertAction>
					<Button variant="outline" size="sm" onClick={copy}>
						<Copy data-icon="inline-start" aria-hidden="true" />
						Copy patch
					</Button>
				</AlertAction>
			)}
		</Alert>
	);
}
