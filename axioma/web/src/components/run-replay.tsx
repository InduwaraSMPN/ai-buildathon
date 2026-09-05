import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import type { RunRecord } from "../content/runs";
import {
	TranscriptFoot,
	TranscriptHead,
	TranscriptMetrics,
	TranscriptSteps,
} from "./transcript";

type ReplayStatus = "idle" | "playing" | "done";

const DEFAULT_CADENCE_MS = 550;
const OBSERVATION_DELAY_MS = 350;

// The one control names what it does next in each state.
const BUTTON_LABEL: Record<ReplayStatus, string> = {
	idle: "Play",
	playing: "Skip to the end",
	done: "Replay",
};

// Shared clock for the two hero transcripts. `frame` starts at 0 on both
// server and client so the first paint matches (no hydration mismatch);
// hiding itself is CSS-gated on `html.js`, this hook only advances the count.
// Playback waits until the watched element reaches the viewport, so a visitor
// who lands further down the page does not miss the run.
export function useReplay(
	runs: RunRecord[],
	opts?: { cadenceMs?: number; watch?: RefObject<HTMLElement | null> },
): {
	frame: number;
	status: ReplayStatus;
	replay: () => void;
	skip: () => void;
} {
	const cadenceMs = opts?.cadenceMs ?? DEFAULT_CADENCE_MS;
	const watch = opts?.watch;
	const total = runs.reduce((max, run) => Math.max(max, run.steps.length), 0);
	const [frame, setFrame] = useState(0);
	const [status, setStatus] = useState<ReplayStatus>("idle");

	const replay = useCallback(() => {
		setFrame(0);
		setStatus("playing");
	}, []);

	const skip = useCallback(() => {
		setFrame(total);
		setStatus("done");
	}, [total]);

	useEffect(() => {
		if (status !== "idle") {
			return;
		}
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			setFrame(total);
			setStatus("done");
			return;
		}
		const target = watch?.current;
		if (!target || typeof IntersectionObserver === "undefined") {
			const raf = window.requestAnimationFrame(() => {
				setStatus("playing");
			});
			return () => window.cancelAnimationFrame(raf);
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					observer.disconnect();
					setStatus("playing");
				}
			},
			// Start once the panel's top edge is inside the upper part of the
			// viewport, not when its last row is.
			{ rootMargin: "0px 0px -15% 0px" },
		);
		observer.observe(target);
		return () => observer.disconnect();
	}, [status, total, watch]);

	useEffect(() => {
		if (status !== "playing") {
			return;
		}
		if (frame >= total) {
			setStatus("done");
			return;
		}
		const nextSteps = runs
			.map((run) => run.steps[frame])
			.filter((step) => step !== undefined);
		const explicit = nextSteps
			.map((step) => step.delayMs)
			.filter((delay): delay is number => typeof delay === "number");
		const isObservation = nextSteps.some((step) => step.kind === "observation");
		const delay =
			explicit.length > 0
				? Math.min(...explicit)
				: isObservation
					? OBSERVATION_DELAY_MS
					: cadenceMs;
		const timeout = setTimeout(() => {
			setFrame((current) => Math.min(current + 1, total));
		}, delay);
		return () => clearTimeout(timeout);
	}, [cadenceMs, frame, runs, status, total]);

	return { frame, status, replay, skip };
}

/**
 * Two runs in one panel, on a shared row grid. Comparison is the whole point
 * of this section, so the step lists are CSS subgrids of the same rows: step n
 * of the fix sits level with step n of the refusal. Both runs open with the
 * same three reads and part company at step four, which only reads as an
 * argument when the rows line up.
 */
export function RunCompare({
	left,
	right,
	frame,
}: {
	left: RunRecord;
	right: RunRecord;
	frame: number;
}) {
	const rows = Math.max(left.steps.length, right.steps.length);
	const columns: Array<{ run: RunRecord; col: "a" | "b" }> = [
		{ run: left, col: "a" },
		{ run: right, col: "b" },
	];

	return (
		<div
			className="run-compare panel"
			style={{ "--compare-rows": rows } as React.CSSProperties}
		>
			{columns.map(({ run, col }) => (
				<TranscriptHead
					key={`head-${run.id}`}
					run={run}
					state={frame >= run.steps.length ? run.outcome : "running"}
					headingLevel={3}
					data-col={col}
				/>
			))}
			{columns.map(({ run, col }) => (
				<TranscriptMetrics key={`metrics-${run.id}`} run={run} data-col={col} />
			))}
			{columns.map(({ run, col }) => (
				<TranscriptSteps
					key={`steps-${run.id}`}
					run={run}
					frame={frame}
					dense
					padRows={rows - run.steps.length}
					className="run-compare-steps"
					aria-label={`Steps for ${run.ticket}`}
					data-col={col}
				/>
			))}
			{columns.map(({ run, col }) => (
				<TranscriptFoot
					key={`foot-${run.id}`}
					run={run}
					done={frame >= run.steps.length}
					live={false}
					data-col={col}
				/>
			))}
			<span className="run-compare-rule" aria-hidden="true" />
		</div>
	);
}

/**
 * The replay with its one control and an optional caption on the same row.
 * The two run footers stay silent for assistive tech; one status line here
 * announces both outcomes once the runs finish.
 */
export function RunReplay({
	id,
	left,
	right,
	caption,
}: {
	id?: string;
	left: RunRecord;
	right: RunRecord;
	caption?: ReactNode;
}) {
	const panel = useRef<HTMLDivElement | null>(null);
	const { frame, status, replay, skip } = useReplay([left, right], {
		watch: panel,
	});

	return (
		<div className="run-replay" id={id} data-status={status} ref={panel}>
			<div className="run-replay-controls">
				{caption ? <p className="run-replay-caption">{caption}</p> : null}
				<button
					type="button"
					className="run-replay-button"
					onClick={status === "playing" ? skip : replay}
				>
					{BUTTON_LABEL[status]}
				</button>
			</div>
			<RunCompare left={left} right={right} frame={frame} />
			<p className="sr-only" role="status">
				{status === "done"
					? `Both runs have finished. ${left.outcomeLine}. ${right.outcomeLine}.`
					: ""}
			</p>
		</div>
	);
}
