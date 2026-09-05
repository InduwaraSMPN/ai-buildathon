import type { ComponentProps } from "react";
import type { RunRecord, RunStep } from "../content/runs";

const HEADINGS = { 2: "h2", 3: "h3", 4: "h4" } as const;

/**
 * `verifies` names the other half of a write/read pair, so the same field
 * reads as "verified by" on the write and "verifies" on the read. Resolve it
 * to the nearest step carrying that tool, preferring one that comes later: a
 * write is followed by its verifying read, never preceded by it.
 */
function resolvePair(
	steps: RunStep[],
	index: number,
): { label: string; tool: string; ordinal: number } | null {
	const tool = steps[index]?.verifies;
	if (!tool) {
		return null;
	}
	const after = steps.findIndex((step, i) => i > index && step.tool === tool);
	if (after !== -1) {
		return { label: "Verified by", tool, ordinal: steps[after].ordinal };
	}
	for (let i = index - 1; i >= 0; i -= 1) {
		if (steps[i].tool === tool) {
			return { label: "Verifies", tool, ordinal: steps[i].ordinal };
		}
	}
	return null;
}

/**
 * The step list: an ordinal, a status marker on a continuous spine, the call,
 * and what came back. Steps the replay has not reached yet stay in the layout
 * as dimmed rows with a hollow marker, so the run's shape is legible from the
 * first paint and nothing shifts as it fills in.
 *
 * `dense` stacks the call above its result for a narrow column; the default
 * sets them side by side, which only fits at full width.
 */
export function TranscriptSteps({
	run,
	frame,
	dense = false,
	padRows = 0,
	className,
	...rest
}: {
	run: RunRecord;
	frame: number;
	dense?: boolean;
	/** Rows this run leaves empty on a grid shared with a longer run. */
	padRows?: number;
	className?: string;
} & ComponentProps<"ol">) {
	const ended = frame >= run.steps.length;
	return (
		<ol
			className={["transcript-steps", dense ? "is-dense" : "", className]
				.filter(Boolean)
				.join(" ")}
			{...rest}
		>
			{run.steps.map((step, index) => {
				const visible = index < frame;
				const pair = resolvePair(run.steps, index);
				return (
					<li
						key={step.ordinal}
						className="transcript-step"
						data-kind={step.kind}
						data-last={index === run.steps.length - 1 ? "true" : undefined}
						data-tone={step.tone ?? "muted"}
						data-visible={visible ? "true" : "false"}
					>
						<span className="step-ordinal" aria-hidden="true">
							{step.ordinal}
						</span>
						<span className="step-marker" aria-hidden="true" />
						<div className="step-call">
							<code className="step-tool">{step.tool ?? step.kind}</code>
							{step.input ? (
								<span className="step-input">{step.input}</span>
							) : null}
						</div>
						<div className="step-result">
							{step.evidence ? (
								<p className="step-evidence">{step.evidence}</p>
							) : null}
							{pair ? (
								<p className="step-pair">
									<span>{pair.label}</span> <code>{pair.tool}</code>
									<span className="step-pair-ref">step {pair.ordinal}</span>
								</p>
							) : null}
						</div>
					</li>
				);
			})}
			{padRows > 0 && run.tailNote ? (
				<li
					className="transcript-tail"
					style={{ gridRow: `span ${padRows}` }}
					data-visible={ended ? "true" : "false"}
				>
					<p>{run.tailNote}</p>
				</li>
			) : null}
		</ol>
	);
}

/** Ticket, environment, and the run's terminal state. */
export function TranscriptHead({
	run,
	state,
	headingLevel = 3,
	...rest
}: {
	run: RunRecord;
	state: string;
	headingLevel?: 2 | 3 | 4;
} & ComponentProps<"header">) {
	const Heading = HEADINGS[headingLevel];
	return (
		<header className="transcript-head" {...rest}>
			<div className="transcript-title">
				<Heading className="transcript-ticket">{run.ticket}</Heading>
				<p className="transcript-env">{run.environment}</p>
			</div>
			<span className="transcript-state" data-state={state}>
				{state}
			</span>
		</header>
	);
}

/** Counts and duration, carried by the record rather than written in prose. */
export function TranscriptMetrics({
	run,
	...rest
}: { run: RunRecord } & ComponentProps<"dl">) {
	return (
		<dl className="transcript-metrics" {...rest}>
			<div>
				<dt>Steps</dt>
				<dd>{run.steps.length}</dd>
			</div>
			{run.toolCalls ? (
				<div>
					<dt>Tool calls</dt>
					<dd>{run.toolCalls}</dd>
				</div>
			) : null}
			<div>
				<dt>Duration</dt>
				<dd>{run.durationSeconds}s</dd>
			</div>
		</dl>
	);
}

/**
 * `live` opts the outcome line out of being a status region, for a parent
 * that announces both runs once instead of twice.
 */
export function TranscriptFoot({
	run,
	done,
	live = true,
	...rest
}: {
	run: RunRecord;
	done: boolean;
	live?: boolean;
} & ComponentProps<"footer">) {
	return (
		<footer className="transcript-foot" {...rest}>
			<p className="transcript-outcome" role={live ? "status" : undefined}>
				{done ? run.outcomeLine : "Running…"}
			</p>
			<p className="transcript-measured">{run.measuredNote}</p>
		</footer>
	);
}

/** One run on its own, at full width. */
export function Transcript({
	run,
	frame,
	headingLevel = 3,
}: {
	run: RunRecord;
	frame: number;
	headingLevel?: 2 | 3 | 4;
}) {
	const done = frame >= run.steps.length;
	return (
		<section
			className="transcript panel"
			aria-label={`Run transcript: ${run.ticket}`}
		>
			<TranscriptHead
				run={run}
				state={done ? run.outcome : "running"}
				headingLevel={headingLevel}
			/>
			<TranscriptMetrics run={run} />
			<TranscriptSteps run={run} frame={frame} />
			<TranscriptFoot run={run} done={done} />
		</section>
	);
}
