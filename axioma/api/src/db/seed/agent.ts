/**
 * Agent runs, transcripts and tool calls.
 *
 * This is the console's headline feature — the run transcript with evidence and
 * takeover — so each run gets a full think → tool_call → observation → decision
 * → terminal sequence rather than a bare row.
 *
 * connectors.ts already creates two minimal runs purely to satisfy device
 * proposal FKs; these use their own ids and do not collide.
 */

import { db } from "@/db";
import { agentRuns, agentSteps, agentToolCalls } from "@/db/schema/agent";
import { DEMO_USERS, daysFromEpoch } from "./data";

type StepSeed = {
	kind: "think" | "tool_call" | "observation" | "decision" | "terminal";
	reasoning?: string;
	toolName?: string;
	toolInput?: Record<string, unknown>;
	toolOutput?: Record<string, unknown>;
	evidence?: string;
	evidenceTone?: "success" | "warning" | "destructive" | "neutral";
	notice?: string;
	error?: string;
};

type RunSeed = {
	id: string;
	ticketIndex: number;
	status: "running" | "resolved" | "escalated" | "failed" | "exhausted";
	outcome: string | null;
	model: string;
	environmentKey: "production" | "staging";
	startedById: string | null;
	day: number;
	promptTokens: number;
	completionTokens: number;
	steps: StepSeed[];
};

const RUNS: RunSeed[] = [
	{
		id: "demo-run-01",
		ticketIndex: 0,
		status: "escalated",
		outcome: "Escalated to human — restart requires change approval",
		model: "claude-opus-5",
		environmentKey: "production",
		startedById: null,
		day: 2,
		promptTokens: 18420,
		completionTokens: 1310,
		steps: [
			{
				kind: "think",
				reasoning:
					"Ticket reports intermittent 502s on the checkout API. First establish whether the errors correlate with a specific pod or are fleet-wide.",
			},
			{
				kind: "tool_call",
				toolName: "kubernetes.list_pods",
				toolInput: { namespace: "checkout", selector: "app=checkout-api" },
			},
			{
				kind: "observation",
				toolName: "kubernetes.list_pods",
				toolOutput: {
					pods: 4,
					notReady: 1,
					restarts: { "checkout-api-7d9f": 14 },
				},
				evidence: "1 of 4 pods is NotReady with 14 restarts in the last hour.",
				evidenceTone: "warning",
			},
			{
				kind: "tool_call",
				toolName: "kubernetes.read_logs",
				toolInput: { pod: "checkout-api-7d9f", tailLines: 200 },
			},
			{
				kind: "observation",
				toolName: "kubernetes.read_logs",
				toolOutput: { matched: "OOMKilled", occurrences: 14 },
				evidence:
					"Pod is being OOMKilled — memory limit 512Mi, working set peaks at 498Mi.",
				evidenceTone: "destructive",
			},
			{
				kind: "decision",
				reasoning:
					"Raising the memory limit is a production workload change and needs CAB approval. Escalating rather than acting.",
			},
			{
				kind: "terminal",
				reasoning:
					"Escalated to the on-call platform engineer with the OOMKill evidence attached.",
				evidence: "Change request drafted: raise checkout-api limit to 1Gi.",
				evidenceTone: "neutral",
			},
		],
	},
	{
		id: "demo-run-02",
		ticketIndex: 1,
		status: "resolved",
		outcome: "VPN profile reissued; reporter confirmed connectivity",
		model: "claude-opus-5",
		environmentKey: "production",
		startedById: null,
		day: 5,
		promptTokens: 9240,
		completionTokens: 720,
		steps: [
			{
				kind: "think",
				reasoning:
					"Repeated VPN disconnects on a single laptop. Check the device certificate expiry before touching the client config.",
			},
			{
				kind: "tool_call",
				toolName: "device.read_inventory",
				toolInput: { hostname: "demo-host-02" },
			},
			{
				kind: "observation",
				toolName: "device.read_inventory",
				toolOutput: { certificateExpiresInDays: -3 },
				evidence: "Device certificate expired 3 days ago.",
				evidenceTone: "warning",
			},
			{
				kind: "decision",
				reasoning:
					"Reissuing a device certificate is reversible and scoped to one device — safe to action automatically.",
			},
			{
				kind: "terminal",
				reasoning: "Certificate reissued and the reporter confirmed the fix.",
				evidence: "VPN session stable for 45 minutes after reissue.",
				evidenceTone: "success",
			},
		],
	},
	{
		id: "demo-run-03",
		ticketIndex: 4,
		status: "resolved",
		outcome: "Mailbox rule corrected; queued mail delivered",
		model: "claude-sonnet-5",
		environmentKey: "production",
		startedById: null,
		day: 8,
		promptTokens: 7110,
		completionTokens: 540,
		steps: [
			{
				kind: "think",
				reasoning:
					"Outbound notifications are queueing. Check the send log for a common failure code before assuming a provider outage.",
			},
			{
				kind: "tool_call",
				toolName: "mail.read_send_log",
				toolInput: { limit: 50 },
			},
			{
				kind: "observation",
				toolName: "mail.read_send_log",
				toolOutput: { failed: 9, code: "550 Mailbox unavailable" },
				evidence: "All 9 failures share a 550 from one recipient domain.",
				evidenceTone: "warning",
			},
			{
				kind: "terminal",
				reasoning: "SPF record corrected; the queue drained on retry.",
				evidence: "0 failures in the 30 minutes after the change.",
				evidenceTone: "success",
			},
		],
	},
	{
		id: "demo-run-04",
		ticketIndex: 7,
		status: "failed",
		outcome: "Tool call failed — environment unreachable",
		model: "claude-sonnet-5",
		environmentKey: "staging",
		startedById: null,
		day: 12,
		promptTokens: 3300,
		completionTokens: 190,
		steps: [
			{
				kind: "think",
				reasoning:
					"Reproduce the reported failure in staging before touching production.",
			},
			{
				kind: "tool_call",
				toolName: "kubernetes.list_pods",
				toolInput: { namespace: "reporting" },
			},
			{
				kind: "observation",
				toolName: "kubernetes.list_pods",
				error: "dial tcp 10.4.0.11:6443: i/o timeout",
				evidence: "Staging cluster did not answer within the 30s timeout.",
				evidenceTone: "destructive",
			},
			{
				kind: "terminal",
				reasoning: "Run aborted — cannot proceed without a reachable cluster.",
				notice: "Retry once the staging control plane is back.",
			},
		],
	},
	{
		id: "demo-run-05",
		ticketIndex: 12,
		status: "exhausted",
		outcome: "Hit the tool-call ceiling without a conclusion",
		model: "claude-opus-5",
		environmentKey: "production",
		startedById: null,
		day: 15,
		promptTokens: 41200,
		completionTokens: 3080,
		steps: [
			{
				kind: "think",
				reasoning:
					"Symptoms are vague — intermittent slowness with no error. Sweep the obvious signals first.",
			},
			{
				kind: "tool_call",
				toolName: "metrics.query",
				toolInput: { query: 'p99_latency{service="portal"}', window: "24h" },
			},
			{
				kind: "observation",
				toolName: "metrics.query",
				toolOutput: { p99Ms: 840, baselineMs: 310 },
				evidence: "p99 is 2.7× baseline but with no clear onset.",
				evidenceTone: "warning",
			},
			{
				kind: "tool_call",
				toolName: "database.slow_queries",
				toolInput: { minDurationMs: 500 },
			},
			{
				kind: "observation",
				toolName: "database.slow_queries",
				toolOutput: { candidates: 0 },
				evidence: "No slow queries above the threshold.",
				evidenceTone: "neutral",
			},
			{
				kind: "terminal",
				reasoning:
					"Reached the tool-call ceiling without isolating a cause. Escalating with the collected signals.",
				notice: "Ceiling reached — a human should take this one over.",
			},
		],
	},
	{
		id: "demo-run-06",
		ticketIndex: 18,
		status: "running",
		outcome: null,
		model: "claude-opus-5",
		environmentKey: "production",
		startedById: null,
		day: 26,
		promptTokens: 5200,
		completionTokens: 260,
		steps: [
			{
				kind: "think",
				reasoning:
					"New report of certificate warnings. Check expiry across the fleet before responding.",
			},
			{
				kind: "tool_call",
				toolName: "device.read_inventory",
				toolInput: { scope: "fleet", check: "certificate_expiry" },
			},
		],
	},
];

export async function seedAgent(ticketIds: string[]): Promise<void> {
	if (!ticketIds.length) {
		console.warn("[seed:agent] no tickets available — skipping agent runs");
		return;
	}

	// A couple of runs are attributed to a human who started them by hand; the
	// rest are auto-dispatched and correctly leave startedById null.
	const staff = DEMO_USERS.filter((u) => u.kind === "staff");

	await db.transaction(async (tx) => {
		for (let r = 0; r < RUNS.length; r++) {
			const run = RUNS[r]!;
			const ticketId = ticketIds[run.ticketIndex % ticketIds.length]!;
			const startedAt = daysFromEpoch(run.day, 9);
			const endedAt =
				run.status === "running" ? null : daysFromEpoch(run.day, 10);

			await tx
				.insert(agentRuns)
				.values({
					id: run.id,
					ticketId,
					startedById:
						r % 3 === 0 ? (staff[r % staff.length]?.id ?? null) : null,
					status: run.status,
					model: run.model,
					outcome: run.outcome,
					workerId: `demo-worker-${(r % 2) + 1}`,
					acceptedAt: startedAt,
					leaseExpiresAt: run.status === "running" ? endedAt : null,
					environmentId:
						run.environmentKey === "production"
							? "demo-env-production"
							: "demo-env-staging",
					environmentKey: run.environmentKey,
					environmentSource: r % 2 === 0 ? "ticket" : "default",
					promptTokens: run.promptTokens,
					completionTokens: run.completionTokens,
					startedAt,
					endedAt,
				})
				.onConflictDoNothing();

			let toolCallIndex = 0;
			for (let s = 0; s < run.steps.length; s++) {
				const step = run.steps[s]!;
				const stepId = `${run.id}-step-${String(s + 1).padStart(2, "0")}`;
				await tx
					.insert(agentSteps)
					.values({
						id: stepId,
						runId: run.id,
						ordinal: s + 1,
						kind: step.kind,
						reasoning: step.reasoning ?? null,
						toolName: step.toolName ?? null,
						toolInput: step.toolInput ?? null,
						toolOutput: step.toolOutput ?? null,
						error: step.error ?? null,
						evidence: step.evidence ?? null,
						notice: step.notice ?? "",
						evidenceTone: step.evidenceTone ?? "neutral",
						createdAt: daysFromEpoch(run.day, 9 + s),
					})
					.onConflictDoNothing();

				// Every tool_call step has a matching tool call record, resolved by
				// the observation that follows it.
				if (step.kind === "tool_call") {
					toolCallIndex++;
					const observation = run.steps[s + 1];
					const failed = Boolean(observation?.error);
					const pending = observation === undefined;
					await tx
						.insert(agentToolCalls)
						.values({
							id: `${run.id}-call-${String(toolCallIndex).padStart(2, "0")}`,
							runId: run.id,
							callId: `call_${run.id.replace(/-/g, "")}_${toolCallIndex}`,
							status: pending ? "in_progress" : failed ? "failed" : "succeeded",
							result: observation?.toolOutput ?? null,
							error: observation?.error ?? null,
							createdAt: daysFromEpoch(run.day, 9 + s),
							finishedAt: pending ? null : daysFromEpoch(run.day, 9 + s + 1),
						})
						.onConflictDoNothing();
				}
			}
		}
	});

	console.log(
		`[seed:agent] seeded ${RUNS.length} runs with transcripts and tool calls`,
	);
}
