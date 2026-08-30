import { createFileRoute, Link } from "@tanstack/react-router";
import { AxiomaMark } from "../components/brand";
import { Arrow, ContactCta } from "../components/site";

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [
			{ title: "Axiōma — IT support, from ticket to action" },
			{
				name: "description",
				content:
					"Axiōma gives Axel the context and tools to route, diagnose, resolve, or clearly escalate an IT support ticket.",
			},
		],
	}),
	component: HomePage,
});

const steps = [
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

type TranscriptLine = {
	at: string;
	kind: "prompt" | "muted" | "accent";
	text: string;
	phase?: string;
};

const transcript: TranscriptLine[] = [
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

const stages = [
	{ title: "Ticket received", note: "Context attached", done: true },
	{
		title: "Evidence gathered",
		note: "ImagePullBackOff · k8s/prod",
		done: true,
	},
	{ title: "Fix checked", note: "Watching rollout", done: false },
];

function Check() {
	return (
		<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
			<path
				d="M2.6 6.3 4.9 8.6 9.4 3.9"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.9"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

const systems: { label: string; note: string; found?: boolean }[] = [
	{ label: "Kubernetes", note: "prod cluster", found: true },
	{ label: "Identity", note: "group + access" },
	{ label: "Device", note: "axel-cli / 017" },
	{ label: "Change log", note: "last 24h" },
];

/**
 * The report arrives on its own; the evidence that explains it does not. One
 * strand resolves green — the system that actually held the cause.
 */
function ContextMap() {
	return (
		<svg
			className="context-map reveal"
			viewBox="0 0 420 300"
			role="img"
			aria-label="A single ticket connected to the four systems its evidence is spread across"
		>
			<title>Where the evidence for one ticket lives</title>
			{systems.map((system, index) => {
				const y = 30 + index * 72;
				return (
					<g key={system.label}>
						<path
							className={system.found ? "map-link is-found" : "map-link"}
							d={`M150 150 C 200 150, 205 ${y + 21}, 250 ${y + 21}`}
						/>
						<rect
							className={system.found ? "map-node is-found" : "map-node"}
							x="250"
							y={y}
							width="162"
							height="42"
							rx="14"
						/>
						<text className="map-label" x="266" y={y + 19}>
							{system.label}
						</text>
						<text className="map-note" x="266" y={y + 32}>
							{system.note}
						</text>
					</g>
				);
			})}
			<rect
				className="map-source"
				x="8"
				y="118"
				width="142"
				height="64"
				rx="18"
			/>
			<text className="map-label is-source" x="26" y="145">
				AX-1042
			</text>
			<text className="map-note is-source" x="26" y="162">
				reported symptom
			</text>
		</svg>
	);
}

function HomePage() {
	return (
		<>
			<section className="hero shell reveal-group">
				<div className="hero-copy">
					<p className="eyebrow reveal">AI IT support / one accountable loop</p>
					<h1 className="reveal">
						From symptom
						<br />
						to <em>resolution.</em>
					</h1>
					<p className="hero-lede reveal">
						Axiōma gives Axel the context and tools to carry an IT ticket from
						an employee’s report to a verified fix—or a clear handoff.
					</p>
					<div className="hero-actions reveal">
						<Link className="button" to="/product">
							See how it works <Arrow />
						</Link>
						<Link className="text-link" to="/contact">
							Talk to Axiōma <Arrow />
						</Link>
					</div>
				</div>
				<TicketVisual />
			</section>

			<section className="statement dark-section">
				<div className="shell statement-grid reveal-group">
					<div className="statement-copy reveal">
						<p className="eyebrow">The missing context</p>
						<h2>Employees report symptoms. Support has to find the cause.</h2>
						<p>
							The evidence needed to route a ticket and fix it often lives
							across systems. Axiōma brings investigation and action into the
							same run, so the path does not end at classification.
						</p>
					</div>
					<ContextMap />
				</div>
			</section>

			<section className="process shell">
				<div className="ledger-index" aria-hidden="true">
					<span>Index 01 — The loop</span>
					<span>File ref. AX-1042 · 3 stages</span>
				</div>
				<div className="section-heading reveal-group">
					<p className="eyebrow reveal">The loop</p>
					<h2 className="reveal">
						One ticket. One reasoning surface. A recorded outcome.
					</h2>
				</div>
				<ol className="step-grid reveal-group">
					{steps.map((step) => (
						<li key={step.number} className="reveal">
							<span>{step.number}</span>
							<h3>{step.title}</h3>
							<p>{step.body}</p>
						</li>
					))}
				</ol>
			</section>

			<section className="device-section shell reveal-group">
				<div className="device-copy">
					<div className="ledger-index reveal" aria-hidden="true">
						<span>Index 02 — At the edge</span>
						<span>axel-cli / device-017</span>
					</div>
					<p className="eyebrow reveal">Across the boundary</p>
					<h2 className="reveal">
						Infrastructure when it is there. The laptop when it is here.
					</h2>
					<p className="reveal">
						Axel works against connected infrastructure, or reaches the
						employee’s device through axel-cli. Device actions are typed and the
						result is read back before the ticket closes.
					</p>
					<Link className="text-link reveal" to="/product">
						Explore the ticket flow <Arrow />
					</Link>
				</div>
				<div
					className="terminal reveal"
					role="img"
					aria-label="Illustration of axel-cli reading device state, running a typed action, then reading the state back"
				>
					<div className="terminal-bar">
						<span className="terminal-dots" aria-hidden="true">
							<i />
							<i />
							<i />
						</span>
						<span>axel-cli / device-017</span>
						<span className="status-dot">connected</span>
					</div>
					<code>
						{transcript.map((line) => (
							<span className="terminal-line" key={line.at + line.text}>
								<span className="terminal-time">{line.at}</span>
								<span className={line.kind}>{line.text}</span>
								<span className="terminal-phase">{line.phase ?? ""}</span>
							</span>
						))}
					</code>
					<div className="terminal-foot">
						<span>Typed action</span>
						<span>Result read back</span>
						<span>No GUI control</span>
					</div>
				</div>
			</section>

			<ContactCta />
		</>
	);
}

function TicketVisual() {
	return (
		<div
			className="ticket-visual reveal"
			role="img"
			aria-label="Work order dossier AX-1042"
		>
			<div className="ticket-holes" aria-hidden="true" />
			<div className="ticket-sheet">
				<div className="ticket-topline">
					<span>AX-1042</span>
					<span className="work-order-label">Work order</span>
					<span className="live-pill">In progress</span>
				</div>
				<h2>Deployment will not start</h2>
				<p>Reported by Maya · Platform Engineering</p>
				<div className="ticket-route">
					{stages.map((stage, index) => (
						<div
							key={stage.title}
							className={stages[index + 1]?.done ? "rail-done" : undefined}
						>
							<span className={stage.done ? "node is-done" : "node"}>
								{stage.done ? <Check /> : null}
							</span>
							<strong>{stage.title}</strong>
							<small>{stage.note}</small>
						</div>
					))}
				</div>
				<div className="ticket-note">
					<span>
						<AxiomaMark className="ticket-note-mark" />
						Axel — 09:42
					</span>
					<p>
						Bad image tag identified. Verifying the intended image before
						patching. Evidence retained for handoff if fix is not permitted.
					</p>
				</div>
			</div>
		</div>
	);
}
