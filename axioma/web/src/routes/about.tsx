import { createFileRoute, Link } from "@tanstack/react-router";
import { ContactBand, PageIntro } from "../components/site";
import { pageMeta } from "../lib/seo";

export const Route = createFileRoute("/about")({
	head: () =>
		pageMeta({
			title: "About — Axiōma",
			description:
				"Why Axiōma keeps diagnosis, action, and accountability in one record.",
			path: "/about",
		}),
	component: AboutPage,
});

function AboutPage() {
	return (
		<>
			<PageIntro
				title="Diagnosis, action, and accountability belong in one record."
				lede="Axiōma is an IT service management platform with an agent inside it. This page explains the problem it starts from, how the team works, what the company refuses to claim, and what the names mean."
			/>

			<section id="problem" className="shell" aria-labelledby="problem-heading">
				<div className="section-heading">
					<h2 id="problem-heading">
						Employees report symptoms. Causes hide elsewhere.
					</h2>
				</div>
				<div className="prose">
					<p>
						Employees describe what they can see. An application will not load,
						a laptop shows unexpected behaviour, a deployment will not start.
						The cause often sits somewhere else entirely: in a cluster, an
						identity system, or the device itself.
					</p>
					<p>
						In a large organisation that gap creates two costs. The first is
						routing the ticket to the team that owns the cause. The second is
						understanding the cause and choosing a fix that can be verified. The
						second dwarfs the first, because reporters describe symptoms, not
						causes, and each handoff rebuilds the diagnosis from scratch.
					</p>
					<p>
						Axiōma targets the second cost before the first. Each run gathers
						evidence first, carries it with the ticket, and records what was
						read, what was changed, and what verified the change.
					</p>
				</div>
			</section>

			<section
				id="how-we-work"
				className="shell"
				aria-labelledby="how-we-work-heading"
			>
				<div className="section-heading">
					<h2 id="how-we-work-heading">How we work</h2>
				</div>
				<div className="grid-3">
					<article>
						<h3>Evidence before action</h3>
						<p>
							Axel reads state before it changes anything, and reads it again
							afterwards. A write that returns OK means the call was accepted.
							The verifying read is what allows the ticket to close, and it is
							stamped by the API rather than claimed by the model.
						</p>
					</article>
					<article>
						<h3>Restraint is a result</h3>
						<p>
							Some diagnoses end in a policy choice rather than a mechanical
							fix. When the available change would decide something only a
							person should decide, Axel escalates with the diagnosis, the
							evidence, and a proposal that a named person approves. Refusal is
							a designed outcome, not a failure.
						</p>
					</article>
					<article>
						<h3>One accountable agent</h3>
						<p>
							Axel is one reasoning surface for the whole run.{" "}
							<code>axel-cli</code> runs typed actions on the device and reports
							state back; it holds no reasoning of its own. Every step is
							recorded against the ticket, the run, and the time, so the record
							can be audited.
						</p>
					</article>
				</div>
			</section>

			<section id="claims" className="shell" aria-labelledby="claims-heading">
				<div className="section-heading">
					<h2 id="claims-heading">What we do not claim</h2>
				</div>
				<div className="prose">
					<p>
						Axiōma makes no performance, savings, or accuracy claims about
						itself. Any timing measured on the demo stack is labelled as
						measured on the demo stack, and should be re-measured on yours.
					</p>
					<p>
						Third-party figures on this site describe the domain, not Axiōma.
						Each figure is attributed to its source and graded: peer-reviewed
						studies are called studies, industry surveys and benchmarks are
						called surveys and benchmarks, and analyst forecasts are labelled as
						forecasts.
					</p>
					<p>
						The full list sits with the research.{" "}
						<Link className="inline-link" to="/impact">
							Read the research
						</Link>
					</p>
				</div>
			</section>

			<section id="naming" className="shell" aria-labelledby="naming-heading">
				<div className="section-heading">
					<h2 id="naming-heading">What the names mean</h2>
				</div>
				<dl className="rows">
					<div>
						<dt>Axiōma</dt>
						<dd>
							The platform. It holds the tickets, the runs, the change records,
							and the configuration. When this site says Axiōma, it means the
							whole system.
						</dd>
					</div>
					<div>
						<dt>Axel</dt>
						<dd>
							The agent inside the platform. Axel reasons over a ticket, calls
							typed tools, verifies each change with a read, and escalates with
							evidence when action would be a policy decision.
						</dd>
					</div>
					<div>
						<dt>
							<code>axel-cli</code>
						</dt>
						<dd>
							The device companion. It runs typed actions on an enrolled Windows
							laptop, claims the device with a code, and reports state back. It
							does not reason; Axel does.
						</dd>
					</div>
				</dl>
			</section>

			<ContactBand />
		</>
	);
}
