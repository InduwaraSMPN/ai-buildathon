import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Circle, Wrench } from "lucide-react";
import { formatDate, PageState } from "@/components/support-ui";
import { agentRunQueries } from "../api/queries";
import type { AgentRun, AgentRunSummary, AgentStep } from "../api/types";

type TranscriptProps =
	| { runs: AgentRun[]; ticketId?: never }
	| { runs?: never; ticketId: string };

export function AgentTranscript(props: TranscriptProps) {
	const query = useQuery({
		...agentRunQueries.ticket(props.ticketId ?? ""),
		enabled: "ticketId" in props,
	});

	if ("ticketId" in props && query.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading transcript"
				description="Retrieving agent activity…"
			/>
		);
	if ("ticketId" in props && query.isError)
		return (
			<PageState
				kind="error"
				title="Transcript unavailable"
				description={query.error.message}
				onRetry={() => query.refetch()}
			/>
		);

	const runs = props.runs ?? query.data?.runs ?? [];
	const steps = runs
		.flatMap((run) => run.steps)
		.toSorted(
			(a, b) =>
				a.createdAt.getTime() - b.createdAt.getTime() || a.ordinal - b.ordinal,
		);

	if (steps.length === 0)
		return (
			<PageState
				kind="empty"
				title="No agent activity"
				description="No transcript steps are available."
			/>
		);

	return (
		<section aria-labelledby="agent-transcript-heading">
			<h2 id="agent-transcript-heading" className="font-semibold text-sm">
				Ordered agent transcript
			</h2>
			<p className="mb-3 text-muted-foreground text-xs">
				{runs.length} runs · {steps.length} steps
			</p>
			<div className="mb-3 grid gap-2 sm:grid-cols-2">
				{runs.map((run) => (
					<RunSummary key={run.id} summary={run} />
				))}
			</div>
			<ol className="overflow-hidden border bg-card">
				{steps.map((step, index) => (
					<li
						key={step.id}
						className="grid grid-cols-[42px_1fr] border-b last:border-b-0"
					>
						<div className="flex justify-center border-r bg-muted/30 py-4">
							<span className="grid size-5 place-items-center bg-foreground font-mono text-[9px] text-background">
								{index + 1}
							</span>
						</div>
						<article className="min-w-0 p-4">
							<div className="flex flex-wrap items-center gap-2">
								<StepIcon step={step} />
								<strong className="text-xs uppercase tracking-wider">
									{step.kind}
								</strong>
								{step.toolName && (
									<span className="border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
										{step.toolName}
									</span>
								)}
								<time className="ml-auto text-[10px] text-muted-foreground">
									{formatDate(step.createdAt)}
								</time>
							</div>
							{step.reasoning && (
								<ValueBlock title="Reasoning" value={step.reasoning} />
							)}
							{step.evidence != null && (
								<ValueBlock title="Evidence" value={step.evidence} />
							)}
							{step.toolInput != null && (
								<ValueBlock title="Tool input" value={step.toolInput} code />
							)}
							{step.toolOutput != null && (
								<ValueBlock title="Tool output" value={step.toolOutput} code />
							)}
							{step.error && (
								<ValueBlock title="Error" value={step.error} error />
							)}
						</article>
					</li>
				))}
			</ol>
		</section>
	);
}

function RunSummary({ summary }: { summary: AgentRunSummary }) {
	return (
		<dl className="grid grid-cols-2 gap-x-3 gap-y-1 border bg-card p-3 text-xs">
			<dt className="text-muted-foreground">Status</dt>
			<dd>{summary.status}</dd>
			<dt className="text-muted-foreground">Outcome</dt>
			<dd>{summary.outcome ?? "Pending"}</dd>
			<dt className="text-muted-foreground">Model</dt>
			<dd>{summary.model ?? "Unknown"}</dd>
			<dt className="text-muted-foreground">Tokens</dt>
			<dd>{(summary.promptTokens ?? 0) + (summary.completionTokens ?? 0)}</dd>
			<dt className="text-muted-foreground">Started</dt>
			<dd>{formatDate(summary.startedAt)}</dd>
			<dt className="text-muted-foreground">Ended</dt>
			<dd>{summary.endedAt ? formatDate(summary.endedAt) : "Running"}</dd>
		</dl>
	);
}

function ValueBlock({
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

function StepIcon({ step }: { step: AgentStep }) {
	if (step.error)
		return (
			<AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
		);
	if (step.toolName || step.kind.toLowerCase().includes("tool"))
		return <Wrench className="size-4 text-violet-500" aria-hidden="true" />;
	if (step.kind.toLowerCase().includes("complete"))
		return (
			<CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
		);
	return <Circle className="size-4 text-sky-500" aria-hidden="true" />;
}
