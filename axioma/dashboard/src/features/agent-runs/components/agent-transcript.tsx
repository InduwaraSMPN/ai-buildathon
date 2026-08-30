import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageState, StatusBadge } from "@/components/support-ui";
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
import type { TicketStatus } from "@/features/tickets/api/types";
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
}: {
	runs: AgentRun[];
	ticketId: string;
	status: TicketStatus;
}) {
	const queryClient = useQueryClient();
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
				reason: "Cancelled by dashboard operator",
			});
			toast.success("Agent run cancelled");
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
			<div className="relative">
				<PageState
					kind="empty"
					title="No agent activity"
					description="No run attempts are available."
				/>
				{status === "open" && (
					<Button
						className="absolute bottom-12 left-1/2 -translate-x-1/2"
						disabled={startMutation.isPending}
						onClick={startRun}
					>
						<Play aria-hidden="true" />
						{startMutation.isPending ? "Starting…" : "Start agent run"}
					</Button>
				)}
			</div>
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
							<RotateCcw aria-hidden="true" />{" "}
							{startMutation.isPending ? "Starting…" : "Rerun"}
						</Button>
					)}
					{selectedRun.status === "running" && (
						<CancelRunButton
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
			{escalation && <EscalationProposal details={escalation} />}
			{steps.length ? (
				<ol className="mt-3 overflow-hidden border bg-card">
					{steps.map((step, index) => (
						<StepCard key={step.id} step={step} number={index + 1} />
					))}
				</ol>
			) : (
				<p className="mt-3 border border-dashed p-6 text-center text-muted-foreground text-xs">
					This run has no transcript steps yet.
				</p>
			)}
		</section>
	);
}

function CancelRunButton({
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
				<Square aria-hidden="true" /> {pending ? "Cancelling…" : "Cancel run"}
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Cancel this agent run?</AlertDialogTitle>
					<AlertDialogDescription>
						The agent will stop after its current operation. This cannot be
						undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Keep running</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={() => {
							setOpen(false);
							onConfirm();
						}}
					>
						Cancel run
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function EscalationProposal({ details }: { details: EscalationDetails }) {
	const patch = details.patchLines.join("\n");
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(patch);
			toast.success("Proposed patch copied");
		} catch {
			toast.error("Could not copy proposed patch");
		}
	};

	return (
		<section
			className="mt-3 border-2 border-orange-500/40 bg-orange-500/5 p-4"
			aria-labelledby="escalation-proposal-heading"
		>
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-[10px] text-orange-700 uppercase tracking-wider dark:text-orange-300">
						Escalated run
					</p>
					<h3
						id="escalation-proposal-heading"
						className="font-semibold text-sm"
					>
						Scheduler capacity escalation
					</h3>
				</div>
				{patch && (
					<Button variant="outline" size="sm" onClick={copy}>
						<Copy aria-hidden="true" /> Copy patch
					</Button>
				)}
			</div>
			{details.schedulerMessage && (
				<div className="mt-3">
					<p className="mb-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
						Scheduler message — quoted verbatim
					</p>
					<blockquote className="border-orange-500 border-l-2 pl-3 text-xs leading-5">
						“{details.schedulerMessage}”
					</blockquote>
				</div>
			)}
			{patch && (
				<div className="mt-3">
					<p className="mb-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
						Proposed patch
					</p>
					<pre className="overflow-x-auto whitespace-pre-wrap break-words border bg-background/70 p-3 font-mono text-xs leading-5">
						{details.patchLines.map((line) => (
							<span
								key={line}
								className={`block ${line.startsWith("+") ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
							>
								{line}
							</span>
						))}
					</pre>
				</div>
			)}
		</section>
	);
}
