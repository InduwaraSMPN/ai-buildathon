// Home page content: the loop steps, axel-cli transcript, and dossier stages.

export type TranscriptLine = {
	at: string;
	kind: "prompt" | "muted" | "accent";
	text: string;
	phase?: string;
};

export const steps = [
	{
		number: "01",
		title: "Understand",
		body: "Axel reads the report alongside the employee, device, and ticket context available to it.",
	},
	{
		number: "02",
		title: "Investigate",
		body: "It gathers evidence from infrastructure or the employee’s laptop before deciding what to do.",
	},
	{
		number: "03",
		title: "Act or escalate",
		body: "An available fix is applied and checked. Otherwise, a human receives the evidence and reasoning.",
	},
];

export const transcript: TranscriptLine[] = [
	{
		at: "09:41:02",
		kind: "prompt",
		text: "$ evidence.read network_state",
		phase: "read",
	},
	{
		at: "09:41:03",
		kind: "muted",
		text: "dns.cache stale · resolver 10.42.0.17",
	},
	{ at: "09:41:04", kind: "muted", text: "adapter up · gateway reachable" },
	{
		at: "09:41:09",
		kind: "prompt",
		text: "$ action.run flush_dns",
		phase: "act",
	},
	{ at: "09:41:11", kind: "muted", text: "exit 0 · 128 entries cleared" },
	{
		at: "09:41:12",
		kind: "prompt",
		text: "$ evidence.read network_state",
		phase: "verify",
	},
	{
		at: "09:41:13",
		kind: "accent",
		text: "✓ dns.cache fresh · issue cleared",
		phase: "cleared",
	},
];

export const stages = [
	{ title: "Ticket received", note: "Context attached", done: true },
	{
		title: "Evidence gathered",
		note: "ImagePullBackOff · k8s/prod",
		done: true,
	},
	{ title: "Fix checked", note: "Watching rollout", done: false },
];

/**
 * The report arrives on its own; the evidence that explains it does not. One
 * strand resolves green — the system that actually held the cause.
 */
export const systems: { label: string; note: string; found?: boolean }[] = [
	{ label: "Kubernetes", note: "prod cluster", found: true },
	{ label: "Identity", note: "group + access" },
	{ label: "Device", note: "axel-cli / 017" },
	{ label: "Change log", note: "last 24h" },
];
