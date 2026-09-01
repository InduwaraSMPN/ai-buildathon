import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Arrow, ContactCta } from "../components/site";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "../components/ui/tabs";
import { groups } from "../content/pricing";
import { pageMeta } from "../lib/seo";

export const Route = createFileRoute("/pricing")({
	head: () =>
		pageMeta({
			title: "Pricing — Axiōma",
			description:
				"Axiōma pricing for teams running IT support, and for enterprises that need dedicated or self-hosted deployments.",
			path: "/pricing",
		}),
	component: PricingPage,
});

function Tick() {
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

function PricingPage() {
	const [active, setActive] = useState(groups[0].id);

	return (
		<>
			<Tabs value={active} onValueChange={setActive}>
				<section className="pricing-intro shell">
					<h1>Choose a plan</h1>
					<p className="pricing-sub">that matches how your support runs.</p>

					<TabsList className="plan-toggle" aria-label="Plan audience">
						{groups.map((item) => (
							<TabsTrigger key={item.id} value={item.id}>
								{item.label}
							</TabsTrigger>
						))}
					</TabsList>
				</section>

				<section className="pricing-section shell">
					{groups.map((item) => (
						<TabsContent key={item.id} value={item.id}>
							<div className="pricing-panel">
								<div className={`plan-grid is-${item.plans.length}`}>
									{item.plans.map((plan) => (
										<article
											key={plan.name}
											className={
												plan.badge ? "plan-card is-featured" : "plan-card"
											}
										>
											<div className="plan-head">
												<span className="plan-icon">
													<plan.icon />
												</span>
												<h2>{plan.name}</h2>
												{plan.badge ? (
													<span className="plan-badge">{plan.badge}</span>
												) : null}
											</div>

											<p className="plan-note">{plan.note}</p>

											<p className="plan-list-label">{plan.listLabel}</p>

											{plan.highlights ? (
												<ul className="plan-highlights">
													{plan.highlights.map((feature) => (
														<li key={feature}>{feature}</li>
													))}
												</ul>
											) : null}

											<ul className="plan-features">
												{plan.features.map((feature) => (
													<li key={feature}>
														<Tick />
														{feature}
													</li>
												))}
											</ul>

											<Link
												className={
													plan.quiet ? "button button-quiet" : "button"
												}
												to="/contact"
											>
												{plan.cta} <Arrow />
											</Link>
										</article>
									))}
								</div>
							</div>
						</TabsContent>
					))}
				</section>
			</Tabs>

			<ContactCta title="Not sure which plan fits the estate you run?" />
		</>
	);
}
