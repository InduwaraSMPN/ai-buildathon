// Abridged transcripts of three runs on the demo stack. Tool names and
// evidence are the real ones; reasoning is shortened.

export type RunStepKind = "tool_call" | "observation" | "think" | "decision";

export interface RunStep {
	ordinal: number;
	kind: RunStepKind;
	tool?: string;
	input?: string;
	evidence?: string;
	tone?: "ok" | "warn" | "bad" | "muted";
	verifies?: string;
	delayMs?: number;
}

export interface RunRecord {
	id: string;
	ticket: string;
	environment: string;
	outcome: "resolved" | "escalated";
	outcomeLine: string;
	durationSeconds: number;
	toolCalls?: number;
	measuredNote: string;
	/** Why this run has no step on a row the run beside it fills. */
	tailNote?: string;
	steps: RunStep[];
}

const MEASURED_NOTE = "Measured on the demo stack; re-measure on yours.";

export const checkoutFix: RunRecord = {
	id: "checkout-fix",
	ticket: "Checkout is down — the service will not start.",
	environment: "production — namespace demo",
	outcome: "resolved",
	outcomeLine: "Image corrected — rollout available 1/1 — ticket closed",
	durationSeconds: 30,
	toolCalls: 8,
	measuredNote: MEASURED_NOTE,
	steps: [
		{
			ordinal: 1,
			kind: "tool_call",
			tool: "knowledge_search",
			input: "checkout ImagePullBackOff approved image",
			evidence:
				"Hybrid result: article demo-kb-article-19 names nginx:1.27-alpine as the approved image",
			tone: "muted",
		},
		{
			ordinal: 2,
			kind: "observation",
			tool: "cluster_read_pods",
			input: "namespace demo — app=checkout",
			evidence: 'ImagePullBackOff — image "nginx:1.99.99-nope" not found',
			tone: "warn",
		},
		{
			ordinal: 3,
			kind: "tool_call",
			tool: "cluster_read_deployment",
			input: "namespace demo — name checkout",
			evidence:
				"container checkout — image nginx:1.99.99-nope — ProgressDeadlineExceeded",
			tone: "warn",
		},
		{
			ordinal: 4,
			kind: "tool_call",
			tool: "cluster_patch_image",
			input: "namespace demo — name checkout — container 0 → nginx:1.27-alpine",
			evidence: "Patch accepted",
			tone: "muted",
			verifies: "cluster_read_deployment",
		},
		{
			ordinal: 5,
			kind: "observation",
			tool: "cluster_read_deployment",
			input: "namespace demo — name checkout",
			evidence:
				"revision 6 — ready 1/1 — Available=True — Progressing=True — nginx:1.27-alpine",
			tone: "ok",
			verifies: "cluster_patch_image",
		},
		{
			ordinal: 6,
			kind: "tool_call",
			tool: "cmdb_record_observation",
			input: "checkout image corrected",
			evidence: "Observation recorded with ticket, run, step, time",
			tone: "muted",
		},
		{
			ordinal: 7,
			kind: "decision",
			tool: "resolve_ticket",
			evidence: "Checkout fixed — rollout green",
			tone: "ok",
		},
	],
};

export const reportingRefusal: RunRecord = {
	id: "reporting-refusal",
	ticket: "Reporting never starts.",
	environment: "production — namespace demo",
	outcome: "escalated",
	outcomeLine: "Escalated with diagnosis — proposal attached, not applied",
	durationSeconds: 20,
	toolCalls: 4,
	measuredNote: MEASURED_NOTE,
	tailNote:
		"No closing step. Resource sizing is owned by the service team, so the ticket stays with a person.",
	steps: [
		{
			ordinal: 1,
			kind: "tool_call",
			tool: "knowledge_search",
			input: "reporting Pending Unschedulable cpu",
			evidence: "Resource sizing owned by service team",
			tone: "muted",
		},
		{
			ordinal: 2,
			kind: "tool_call",
			tool: "cluster_read_pods",
			input: "namespace demo — app=reporting",
			evidence:
				"Pending — Unschedulable — 0/1 nodes are available: 1 Insufficient cpu; preemption is not helpful for scheduling",
			tone: "warn",
		},
		{
			ordinal: 3,
			kind: "tool_call",
			tool: "cluster_read_deployment",
			input: "namespace demo — name reporting",
			evidence:
				'0/1 ready — Available=False — container reporting image nginx:stable — requests.cpu: "64"',
			tone: "warn",
		},
		{
			ordinal: 4,
			kind: "think",
			evidence:
				"Shrinking CPU changes the performance contract; adding capacity is not in the API",
			tone: "muted",
		},
		{
			ordinal: 5,
			kind: "tool_call",
			tool: "cmdb_record_observation",
			input: "reporting diagnosis recorded",
			evidence: "Diagnosis recorded with ticket, run, step, time",
			tone: "muted",
		},
		{
			ordinal: 6,
			kind: "decision",
			tool: "escalate_ticket",
			input: "proposal before cpu: 64 attached, not applied",
			evidence: "Insufficient cpu — escalated with diagnosis",
			tone: "warn",
		},
	],
};

export const proxyLaptopFix: RunRecord = {
	id: "proxy-laptop-fix",
	ticket: "I cannot reach internal sites since this morning.",
	environment: "device — claimed laptop",
	outcome: "resolved",
	outcomeLine: "Proxy off — connection direct — ticket closed",
	durationSeconds: 57,
	toolCalls: 8,
	measuredNote: MEASURED_NOTE,
	steps: [
		{
			ordinal: 1,
			kind: "tool_call",
			tool: "knowledge_search",
			input: "cannot reach internal sites proxy",
			evidence: "Proxy fault: disable_proxy then re-read",
			tone: "muted",
		},
		{
			ordinal: 2,
			kind: "tool_call",
			tool: "device_read_state",
			input: "[proxy]",
			evidence:
				'proxy raw: {"override":"","server":"127.0.0.1:9","enabled":true}',
			tone: "warn",
		},
		{
			ordinal: 3,
			kind: "tool_call",
			tool: "device_run_action",
			input: "disable_proxy",
			evidence: "Command accepted",
			tone: "muted",
			verifies: "device_read_state",
		},
		{
			ordinal: 4,
			kind: "observation",
			tool: "device_read_state",
			input: "[proxy]",
			evidence:
				'proxy raw: {"override":"","server":"127.0.0.1:9","enabled":false}',
			tone: "ok",
			verifies: "device_run_action",
		},
		{
			ordinal: 5,
			kind: "tool_call",
			tool: "cmdb_record_observation",
			input: "proxy disabled, verified",
			evidence: "Observation recorded with ticket, run, step, time",
			tone: "muted",
		},
		{
			ordinal: 6,
			kind: "decision",
			tool: "resolve_ticket",
			evidence: "Browser loads again — ticket closed",
			tone: "ok",
		},
	],
};

export const runs: Record<string, RunRecord> = {
	[checkoutFix.id]: checkoutFix,
	[reportingRefusal.id]: reportingRefusal,
	[proxyLaptopFix.id]: proxyLaptopFix,
};

export const runList: RunRecord[] = [
	checkoutFix,
	reportingRefusal,
	proxyLaptopFix,
];
