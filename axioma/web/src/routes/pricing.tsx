import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Rocket, Server, Users, Zap } from "lucide-react";
import { type ComponentType, useState } from "react";
import { Arrow, ContactCta } from "../components/site";

export const Route = createFileRoute("/pricing")({
	head: () => ({
		meta: [
			{ title: "Pricing — Axiōma" },
			{
				name: "description",
				content:
					"Axiōma pricing for teams running IT support, and for enterprises that need dedicated or self-hosted deployments.",
			},
		],
	}),
	component: PricingPage,
});

type Plan = {
	name: string;
	icon: ComponentType<{ className?: string }>;
	price: string;
	per?: string;
	badge?: string;
	note: string;
	listLabel: string;
	/** Rendered as a bulleted block above the checked feature list. */
	highlights?: string[];
	features: string[];
	cta: string;
	quiet?: boolean;
};

/**
 * PLACEHOLDER PRICING. Axiōma has no published price list — these figures and
 * limits are stand-ins so the page can be designed and reviewed. Replace every
 * `price`, `per`, and usage number below before this page goes live.
 */
const groups: { id: string; label: string; plans: Plan[] }[] = [
	{
		id: "teams",
		label: "Teams",
		plans: [
			{
				name: "Pilot",
				icon: Rocket,
				price: "$0",
				per: "/month",
				note: "Point Axel at a single ticket queue and follow one run end to end, with every action recorded.",
				listLabel: "Includes",
				features: [
					"Employee portal and ticket queue",
					"One connected environment",
					"Read-only evidence gathering",
					"Typed device actions on 5 devices",
					"100 agent runs a month",
				],
				cta: "Start a pilot",
				quiet: true,
			},
			{
				name: "Team",
				icon: Users,
				price: "$39",
				per: "/seat/month",
				badge: "Most chosen",
				note: "For an IT team running day-to-day support, with Axel routing, investigating and resolving tickets.",
				listLabel: "Everything in Pilot, plus:",
				features: [
					"Unlimited connected environments",
					"Typed actions on every enrolled device",
					"Approvals and escalation routing",
					"Knowledge and change history",
					"5,000 agent runs a month",
				],
				cta: "Get started",
			},
			{
				name: "Scale",
				icon: Zap,
				price: "$79",
				per: "/seat/month",
				note: "For larger estates that need computer-use for GUI-only tools and tighter control over what Axel may do.",
				listLabel: "Everything in Team, plus:",
				features: [
					"Computer-use for GUI-only paths",
					"Custom connectors and device actions",
					"Policy controls per action tier",
					"Audit export",
					"25,000 agent runs a month",
				],
				cta: "Get started",
			},
		],
	},
	{
		id: "enterprise",
		label: "Enterprise",
		plans: [
			{
				name: "Enterprise",
				icon: Building2,
				price: "Custom",
				note: "For estates where access, policy and evidence retention are reviewed before anything is switched on.",
				listLabel: "Built around your review",
				highlights: [
					"Unlimited seats",
					"Dedicated environments",
					"Named support engineer",
				],
				features: [
					"SSO and SCIM provisioning",
					"Action policy review per tier",
					"Evidence retention controls",
					"Volume agent runs",
				],
				cta: "Talk to us",
			},
			{
				name: "Self-hosted",
				icon: Server,
				price: "Custom",
				note: "Run the API, the agent, and device connectivity inside your own cloud, against your own model provider.",
				listLabel: "Runs in your cloud",
				highlights: [
					"Your infrastructure",
					"Bring your own model provider",
					"Private device connectivity",
				],
				features: [
					"Deployment and runbook handover",
					"Upgrade path on your schedule",
					"Air-gapped device options",
					"Annual contract",
				],
				cta: "Talk to us",
			},
		],
	},
];

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
	const group = groups.find((item) => item.id === active) ?? groups[0];

	return (
		<>
			<section className="pricing-intro shell">
				<h1>Choose a plan</h1>
				<p className="pricing-sub">that matches how your support runs.</p>

				<div className="plan-toggle" role="tablist" aria-label="Plan audience">
					{groups.map((item) => (
						<button
							key={item.id}
							type="button"
							role="tab"
							id={`plan-tab-${item.id}`}
							aria-selected={item.id === active}
							aria-controls={`plan-panel-${item.id}`}
							className={item.id === active ? "is-active" : undefined}
							onClick={() => setActive(item.id)}
						>
							{item.label}
						</button>
					))}
				</div>
			</section>

			<section className="pricing-section shell">
				<div
					className="pricing-panel"
					id={`plan-panel-${group.id}`}
					role="tabpanel"
					aria-labelledby={`plan-tab-${group.id}`}
				>
					<div className={`plan-grid is-${group.plans.length}`}>
						{group.plans.map((plan) => (
							<article
								key={plan.name}
								className={plan.badge ? "plan-card is-featured" : "plan-card"}
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

								<p className="plan-price">
									<strong>{plan.price}</strong>
									{plan.per ? <span>{plan.per}</span> : null}
								</p>

								<p className="plan-note">{plan.note}</p>

								<p className="plan-list-label">{plan.listLabel}</p>

								{plan.highlights ? (
									<ul className="plan-highlights">
										{plan.highlights.map((item) => (
											<li key={item}>{item}</li>
										))}
									</ul>
								) : null}

								<ul className="plan-features">
									{plan.features.map((item) => (
										<li key={item}>
											<Tick />
											{item}
										</li>
									))}
								</ul>

								<Link
									className={plan.quiet ? "button button-quiet" : "button"}
									to="/contact"
								>
									{plan.cta} <Arrow />
								</Link>
							</article>
						))}
					</div>
				</div>

				<p className="pricing-foot">
					Every plan keeps the same loop: evidence before action, a checked fix,
					or an escalation that carries its reasoning.
				</p>
			</section>

			<ContactCta title="Not sure which plan fits the estate you run?" />
		</>
	);
}
