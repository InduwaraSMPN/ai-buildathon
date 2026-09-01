import { createFileRoute } from "@tanstack/react-router";
import { ContactCta, PageIntro } from "../components/site";
import { flow } from "../content/product";
import { pageMeta } from "../lib/seo";

export const Route = createFileRoute("/product")({
	head: () =>
		pageMeta({
			title: "Product — Axiōma",
			description:
				"Follow an Axiōma ticket from creation through routing, evidence, remediation, closure, or escalation.",
			path: "/product",
		}),
	component: ProductPage,
});

function ProductPage() {
	return (
		<>
			<PageIntro
				eyebrow="Product / the ticket flow"
				title="A support loop that can finish the work."
			>
				<p>
					Axiōma connects the employee portal, Axel’s reasoning, enterprise
					infrastructure, and the employee’s laptop. Every run ends in a checked
					fix or an informed human handoff.
				</p>
			</PageIntro>

			<section
				id="ticket-flow"
				className="flow-section shell"
				aria-labelledby="flow-heading"
			>
				<h2 id="flow-heading" className="sr-only">
					Ticket flow
				</h2>
				<ol className="flow-list">
					{flow.map((item) => (
						<li key={item.number}>
							<div className="flow-index">{item.number}</div>
							<div>
								<span className="tag">{item.tag}</span>
								<h3>{item.title}</h3>
							</div>
							<p>{item.body}</p>
						</li>
					))}
				</ol>
			</section>

			<section id="decisions" className="decision-section dark-section">
				<div className="shell">
					<div className="section-heading split-heading">
						<div>
							<p className="eyebrow">A deliberate order</p>
							<h2>Use the narrowest tool that can solve the problem.</h2>
						</div>
						<p>
							Device remediation starts with typed actions. Computer-use is
							reserved for GUI-only paths. When the available action would make
							a policy decision, Axel escalates instead.
						</p>
					</div>
					<div className="decision-grid">
						<article>
							<span>01</span>
							<h3>Typed action</h3>
							<p>
								A defined command with a specific result that can be read back.
							</p>
						</article>
						<article>
							<span>02</span>
							<h3>Computer-use</h3>
							<p>
								For the tail of GUI-only tools where no programmatic path
								exists.
							</p>
						</article>
						<article>
							<span>03</span>
							<h3>Human handoff</h3>
							<p>
								A complete escalation when action is unavailable or
								inappropriate.
							</p>
						</article>
					</div>
				</div>
			</section>

			<section id="roles" className="roles shell">
				<div className="section-heading">
					<p className="eyebrow">One system / three views</p>
					<h2>Clear work for every person in the loop.</h2>
				</div>
				<div className="roles-grid">
					<article>
						<h3>Employee</h3>
						<p>
							Open a ticket, follow progress in plain language, and see what
							changed.
						</p>
					</article>
					<article>
						<h3>IT support</h3>
						<p>
							See the queue, inspect Axel’s evidence, and take over escalations.
						</p>
					</article>
					<article>
						<h3>Platform engineer</h3>
						<p>Define the connectors and device actions available to Axel.</p>
					</article>
				</div>
			</section>
			<ContactCta title="Start with the support loop you need to see clearly." />
		</>
	);
}
