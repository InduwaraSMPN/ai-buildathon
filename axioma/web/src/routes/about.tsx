import { createFileRoute } from "@tanstack/react-router";
import { ContactCta, PageIntro } from "../components/site";
import { pageMeta } from "../lib/seo";

export const Route = createFileRoute("/about")({
	head: () =>
		pageMeta({
			title: "About — Axiōma",
			description:
				"Axiōma is building one accountable loop from an employee’s IT ticket to action or informed escalation.",
			path: "/about",
		}),
	component: AboutPage,
});

function AboutPage() {
	return (
		<>
			<PageIntro
				eyebrow="Company / Axiōma"
				title="Support should preserve the path to an answer."
			>
				<p>
					Axiōma is building an AI IT-support platform around a simple idea: the
					work of understanding a ticket should not be discarded before the work
					of resolving it begins.
				</p>
			</PageIntro>

			<section className="about-statement dark-section">
				<div className="shell about-grid">
					<p className="eyebrow">Why this company</p>
					<div>
						<h2>Keep diagnosis, action, and accountability together.</h2>
						<p>
							Employees describe what they can see. The cause may sit in a
							cluster, an identity system, or their own machine. We are
							connecting those boundaries so one support run can gather
							evidence, take an available action, and preserve the reasoning
							either way.
						</p>
					</div>
				</div>
			</section>

			<section className="principles shell">
				<div className="section-heading">
					<p className="eyebrow">How we approach the work</p>
					<h2>Built around legible decisions.</h2>
				</div>
				<div className="principle-grid">
					<article>
						<span>01</span>
						<h3>Evidence before action</h3>
						<p>
							Axel gathers state before choosing a fix, then reads state again
							to check the result.
						</p>
					</article>
					<article>
						<span>02</span>
						<h3>Restraint is a result</h3>
						<p>
							Some diagnoses lead to policy choices, not mechanical fixes. A
							useful system knows when to hand off.
						</p>
					</article>
					<article>
						<span>03</span>
						<h3>One accountable agent</h3>
						<p>
							Axel is one reasoning surface. axel-cli executes typed device
							actions; it does not make its own decisions.
						</p>
					</article>
				</div>
			</section>
			<ContactCta title="Let’s talk about the boundary between tickets and action." />
		</>
	);
}
