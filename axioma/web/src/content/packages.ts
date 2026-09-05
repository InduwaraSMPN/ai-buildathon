// Deployment packages: three ways to deploy. No figures, no quotas.

export interface Package {
	id: string;
	name: string;
	mode: string;
	body: string;
	includes: string[];
	ctaLabel: string;
	ctaTo: "/contact";
}

export const packages: Package[] = [
	{
		id: "shadow-pilot",
		name: "Shadow pilot",
		mode: "shadow",
		body: "Axel reads live tickets and proposes fixes without applying them. Each proposal is recorded for review.",
		includes: [
			"One environment in shadow mode",
			"Read-only evidence gathering",
			"Every attempted write recorded and none applied",
			"Transcript review with your team",
		],
		ctaLabel: "Start a shadow-mode pilot",
		ctaTo: "/contact",
	},
	{
		id: "platform",
		name: "Platform",
		mode: "act",
		body: "Axel resolves tickets inside your infrastructure with act mode per environment and the full service desk around it.",
		includes: [
			"Act mode per environment",
			"Enrolled Windows devices with typed actions",
			"Device command approvals with separation of duty",
			"Change records, CMDB provenance, knowledge, and catalogue",
			"SLA and OLA, rules and workflows",
			"Email and messaging channels",
			"Roles and capability keys",
		],
		ctaLabel: "Ask about Platform",
		ctaTo: "/contact",
	},
	{
		id: "enterprise",
		name: "Enterprise",
		mode: "act",
		body: "Platform with the review, coexistence, and handover an estate requires before anything is switched on.",
		includes: [
			"Everything in Platform",
			"SSO and OIDC",
			"ServiceNow coexistence",
			"Directory sync",
			"Named support",
			"Deployment handover",
		],
		ctaLabel: "Ask about Enterprise",
		ctaTo: "/contact",
	},
];

export const packagesFootnote = "No quotas and no per-run counts.";

export const pilotSteps: string[] = [
	"Run in shadow mode for a fortnight",
	"Compare each proposal with what your team did",
	"Switch one environment to act",
];
