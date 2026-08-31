/**
 * Pure write-back logic: backoff, state transition, and note rendering.
 *
 * Kept apart from `writeback.ts` for the same reason `workflows/core.ts` is
 * kept apart from `workflows/webhooks.ts` — these are the decisions, and they
 * are testable without a database, a network, or a validated environment.
 */

/**
 * Exponential backoff that terminates by returning null.
 *
 * The null is the signal, not a sentinel delay — a caller that treats "no
 * delay" as "retry immediately" would spin, so the type makes the terminal
 * case explicit.
 */
export function writebackDelayMs(
	attempt: number,
	{ baseMs = 1_000, maxMs = 60_000, maxAttempts = 5 } = {},
): number | null {
	if (attempt < 1) return baseMs;
	if (attempt >= maxAttempts) return null;
	return Math.min(maxMs, baseMs * 2 ** (attempt - 1));
}

/** Maps an attempt's result onto the row's next state. Pure, so it is testable. */
export function writebackOutcome(
	attempt: number,
	maxAttempts: number,
	failed: boolean,
	now: Date,
) {
	const delay = failed ? writebackDelayMs(attempt, { maxAttempts }) : null;
	return {
		status: failed
			? delay === null
				? ("failed" as const)
				: ("retrying" as const)
			: ("succeeded" as const),
		nextAttemptAt: delay === null ? null : new Date(now.getTime() + delay),
		completedAt: failed && delay !== null ? null : now,
	};
}

/**
 * Renders the note a run produces.
 *
 * Action first, deliberately. The SRE test for any machine-generated message
 * is whether the recipient can take a specific action from it — an alert that
 * cannot be acted on should not exist — and the recommended shape leads with
 * what happened and *what to do first*. The base rates for reading machine
 * proposals are poor enough that burying the ask under a diagnosis is the
 * same as not making it.
 *
 * Plain text, because the transcript is plain text and a journal field is not
 * a markdown surface. The proposal is not generated here: it is the transcript
 * rendered, which is the whole reason the shadow guard suppresses at the tool
 * layer rather than asking the model to describe what it would have done.
 */
export function renderWorkNote(params: {
	shadow: boolean;
	status: string;
	outcome: string | null;
	evidence: string | null;
	resolutionCode: string | null;
	suppressedCalls: readonly { tool: string; input: unknown }[];
	runUrl: string | null;
}): string {
	const lines: string[] = [];

	lines.push(
		params.shadow
			? "Axiōma ran in shadow mode. Nothing was changed."
			: "Axiōma worked this ticket.",
	);
	lines.push("");
	lines.push(`What to do: ${whatToDo(params)}`);

	if (params.outcome) {
		lines.push("");
		lines.push(`Diagnosis: ${params.outcome}`);
	}
	if (params.resolutionCode)
		lines.push(`Resolution code: ${params.resolutionCode}`);

	if (params.suppressedCalls.length) {
		lines.push("");
		lines.push(params.shadow ? "Proposed, not taken:" : "Actions taken:");
		for (const call of params.suppressedCalls)
			lines.push(`- ${call.tool} ${JSON.stringify(call.input)}`);
	}

	if (params.evidence) {
		lines.push("");
		lines.push("Evidence:");
		lines.push(params.evidence);
	}

	if (params.runUrl) {
		lines.push("");
		lines.push(`Full transcript: ${params.runUrl}`);
	}
	return lines.join("\n");
}

/**
 * The one line a technician has to read.
 *
 * Every branch names something a person can do, including the branch where the
 * answer is that nothing is needed — "no action" is itself an action decision
 * and saying it plainly is what stops the note being re-read later.
 */
function whatToDo(params: {
	shadow: boolean;
	status: string;
	suppressedCalls: readonly { tool: string; input: unknown }[];
}): string {
	if (params.shadow)
		return params.suppressedCalls.length
			? "Review the proposal below and decide whether to apply it yourself. Axiōma did not act."
			: "Nothing — Axiōma reached no action worth proposing. Work this ticket normally.";
	if (params.status === "resolved")
		return "Nothing — the fix was applied and verified. Close this ticket if you agree.";
	if (params.status === "escalated")
		return "Take this over. Axiōma stopped deliberately; its reasoning and evidence are below.";
	return "Take this over. Axiōma could not finish, so treat its findings as partial.";
}
