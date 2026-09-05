import { createFileRoute } from "@tanstack/react-router";
import { PageIntro } from "../components/site";
import { CONTACT_EMAIL, PILOT_MAILTO } from "../content/site";
import { pageMeta } from "../lib/seo";

export const Route = createFileRoute("/contact")({
	head: () =>
		pageMeta({
			title: "Contact — Axiōma",
			description:
				"One address for a shadow-mode pilot or a question about the loop.",
			path: "/contact",
		}),
	component: ContactPage,
});

function ContactPage() {
	return (
		<>
			<PageIntro
				title="Tell us which ticket class you want to see closed without a human."
				lede="Share the environment, the device boundary, and the decisions that must remain human. We continue the conversation by email."
			/>
			<section className="contact-block shell">
				<div className="contact-card panel">
					<h2>Start a shadow-mode pilot</h2>
					<a href={PILOT_MAILTO}>{CONTACT_EMAIL}</a>
					<p>
						This opens your email client. This website does not submit a form or
						store your contact data.
					</p>
				</div>
				<aside className="panel">
					<h2>Useful context</h2>
					<ul>
						<li>Your environments and how many there are</li>
						<li>Whether Windows laptops are managed</li>
						<li>Whether ServiceNow remains the front door</li>
						<li>Which actions must stay human decisions</li>
					</ul>
					<h3>What happens next</h3>
					<p>
						We reply by email and agree the ticket classes for a shadow-mode
						pilot.
					</p>
				</aside>
			</section>
		</>
	);
}
