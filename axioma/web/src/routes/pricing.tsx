import { createFileRoute } from "@tanstack/react-router";
import { PackageList } from "../components/package-list";
import { ContactBand } from "../components/site";
import { packages, packagesFootnote, pilotSteps } from "../content/packages";
import { pageMeta } from "../lib/seo";

export const Route = createFileRoute("/pricing")({
	head: () =>
		pageMeta({
			title: "Deployment packages — Axiōma",
			description:
				"Shadow pilot, Platform, and Enterprise. No figures and no quotas; every package installs in your own infrastructure.",
			path: "/pricing",
		}),
	component: PricingPage,
});

function PricingPage() {
	return (
		<>
			<section className="page-intro shell">
				<h1>Three ways to deploy. No figures on this page.</h1>
				<div className="lede">
					<p>
						Every package installs inside your own infrastructure from the same
						Helm chart. Prices come from a conversation, because each stack is
						sized to one customer.
					</p>
				</div>
			</section>

			<section className="shell" aria-labelledby="packages-heading">
				<div className="section-heading">
					<h2 id="packages-heading">Deployment packages</h2>
					<p>
						Each package is the same Helm chart with a different amount switched
						on. What separates them is scope and governance, not a quota.
					</p>
				</div>
				<PackageList packages={packages} />
				<p className="meta">{packagesFootnote}</p>
			</section>

			<section className="shell" aria-labelledby="pilot-heading">
				<div className="section-heading">
					<h2 id="pilot-heading">How a pilot runs</h2>
				</div>
				<ol className="sequence">
					{pilotSteps.map((step) => (
						<li key={step}>{step}</li>
					))}
				</ol>
			</section>

			<ContactBand title="Start with a shadow-mode pilot." />
		</>
	);
}
