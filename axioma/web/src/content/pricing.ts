// Pricing page content: tier groups. No figures by design.

import { Building2, Rocket, Server, Users, Zap } from "lucide-react";
import type { ComponentType } from "react";

type Plan = {
	name: string;
	icon: ComponentType<{ className?: string }>;
	badge?: string;
	note: string;
	listLabel: string;
	/** Rendered as a bulleted block above the checked feature list. */
	highlights?: string[];
	features: string[];
	cta: string;
	quiet?: boolean;
};

/** Pricing is intentionally figure-free: tiers describe coverage, and every CTA routes to a conversation (decision D5 in context/DECISIONS.md). Real figures drop into this file when they exist. */
export const groups: { id: string; label: string; plans: Plan[] }[] = [
	{
		id: "teams",
		label: "Teams",
		plans: [
			{
				name: "Pilot",
				icon: Rocket,
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
