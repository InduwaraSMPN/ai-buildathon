import { createFileRoute, Link } from "@tanstack/react-router";
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
					<p className="eyebrow reveal">The missing context</p>
					<h2 className="reveal">Employees report symptoms. Support has to find the cause.</h2>
					<p className="reveal">
						The evidence needed to route a ticket and fix it often lives across
						systems. Axiōma brings investigation and action into the same run,
						so the path does not end at classification.
					</p>
				</div>
			</section>

			<section className="process shell">
				<div className="ledger-index" aria-hidden="true">
					<span>Index 01 — The loop</span>
					<span>File ref. AX-1042 · 3 stages</span>
				</div>
				<div className="section-heading reveal-group">
					<p className="eyebrow reveal">The loop</p>
					<h2 className="reveal">One ticket. One reasoning surface. A recorded outcome.</h2>
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
					<h2 className="reveal">Infrastructure when it is there. The laptop when it is here.</h2>
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
					aria-label="Illustration of a device action"
				>
					<div className="terminal-bar">
						<span>axel-cli / device-017</span>
						<span className="status-dot">connected</span>
					</div>
					<code>
						<span>$ evidence.read network_state</span>
						<span className="muted">DNS cache: stale · 10.42.0.17</span>
						<span>$ action.run flush_dns</span>
						<span className="accent">✓ state re-read / issue cleared</span>
					</code>
				</div>
			</section>

			<ContactCta />
		</>
	);
}

function TicketVisual() {
	return (
		<div className="ticket-visual reveal" role="img" aria-label="Work order dossier AX-1042">
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
					<div>
						<span className="node active">A</span>
						<strong>Ticket received</strong>
						<small>Context attached</small>
					</div>
					<div>
						<span className="node active">A</span>
						<strong>Evidence gathered</strong>
						<small>ImagePullBackOff · k8s/prod</small>
					</div>
					<div>
						<span className="node">A</span>
						<strong>Fix checked</strong>
						<small>Watching rollout</small>
					</div>
				</div>
				<div className="ticket-note">
					<span>Axel — 09:42</span>
					<p>
						Bad image tag identified. Verifying the intended image before
						patching. Evidence retained for handoff if fix is not permitted.
					</p>
				</div>
			</div>
		</div>
	);
}
