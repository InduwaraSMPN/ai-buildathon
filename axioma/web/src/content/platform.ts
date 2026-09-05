// Platform groups: the service-management surfaces around the agent.
// Bodies are plain declarative present tense, UK spelling.

export interface PlatformGroup {
	id: string;
	title: string;
	body: string;
	points: string[];
}

export const platformGroups: PlatformGroup[] = [
	{
		id: "intake",
		title: "Intake",
		body: "Every ticket starts in one record with its origin recorded. The portal, email, and messaging channels all create the same ticket.",
		points: [
			"Portal with streaming draft composition and deflection to articles",
			"Email intake with threading by retained ticket reference",
			"Messaging channels and threads",
			"Origin is recorded because a monitoring alert is not an employee claim",
			"Ticket body is fenced as data and never selects a tool",
		],
	},
	{
		id: "queue",
		title: "Queue",
		body: "The queue shows the work, who holds it, and how long it has waited. Every change to a ticket leaves a record.",
		points: [
			"SLA and OLA stopwatches against business-hours calendars",
			"Presence shows who else views a ticket",
			"Saved views organise the queue per team",
			"Merge and link keep duplicate reports in one place",
			"Ticket audit records every change",
			"Time entries record the work spent",
		],
	},
	{
		id: "catalogue",
		title: "Catalogue",
		body: "The catalogue describes what employees may request. Requests wait where a human decision is required.",
		points: [
			"Service catalogue with subcategories",
			"Forms and templates define each request",
			"Catalogue requests block on a manager decision",
			"Approvals record who decided and when",
		],
	},
	{
		id: "change-enablement",
		title: "Change enablement",
		body: "Changes carry their plan, their approval, and their result. Cluster writes raise their own change record.",
		points: [
			"CAB membership and voting govern each change",
			"Cluster writes create a standard change record automatically",
			"Each change record carries a rollback plan",
			"Each cluster change carries a post-change verification deadline",
		],
	},
	{
		id: "problems-known-errors",
		title: "Problems and known errors",
		body: "Repeat failures are recorded once and linked to each ticket they explain. A known error tells the next run what already holds.",
		points: [
			"Problem records group related tickets",
			"Known-error records capture cause and workaround",
			"Tickets link to the problem they belong to",
			"Axel reads the same records that IT staff read",
		],
	},
	{
		id: "knowledge",
		title: "Knowledge",
		body: "Knowledge is versioned, organised, and access controlled. Axel searches the same authorised corpus that IT staff read.",
		points: [
			"Versions keep the history of each article",
			"Folders and tags organise the corpus",
			"ACL controls who may read each article",
			"Public articles are available to employees",
			"Automatic gap detection flags missing coverage",
		],
	},
	{
		id: "cmdb",
		title: "CMDB",
		body: "The CMDB records what exists and how it relates. Every observation carries its provenance.",
		points: [
			"Typed classes with properties describe each object",
			"Relationships link objects to each other",
			"Provenance records ticket, run, step, and time",
			"Impact walk follows relationships from a failed object",
		],
	},
	{
		id: "assets",
		title: "Assets",
		body: "Assets, licences, and suppliers live beside the tickets that concern them. Imports keep the inventory current.",
		points: [
			"Asset inventory records each item",
			"Imports preview, apply, and record rejections",
			"Software licences track entitlements and allocations",
			"Suppliers and contracts record who provides what",
			"Scheduling sets dates and recurrences for work",
		],
	},
	{
		id: "automation",
		title: "Automation",
		body: "Rules, workflows, and webhooks carry out the routine steps. Each firing is recorded where it happened.",
		points: [
			"Rules engine over tickets with recorded firings",
			"Workflows run with recorded executions",
			"Webhooks deliver with retry",
			"API keys share the capability vocabulary with per-key rate limits",
		],
	},
	{
		id: "people",
		title: "People",
		body: "People, roles, and access follow one capability model. Deny by default is structural rather than conventional.",
		points: [
			"Directory sync imports people with job title, department, and manager chain",
			"Directory sync refuses a run that loses more than 40 percent of the directory",
			"Roles carry capability keys and every procedure names one",
			"Deny by default holds across roles and API keys",
			"SSO and OIDC authenticate each account",
		],
	},
	{
		id: "devices",
		title: "Devices",
		body: "Laptops enrol, prove their holder, and receive only typed actions. General commands wait for a named approver.",
		points: [
			"Enrolment tokens provision each device",
			"Claim codes bind a device to its holder",
			"Rotation and revocation end trust when it changes",
			"Command approval queue holds each proposed command",
			"Approvals are digest-bound, single-use, and expire undecided",
		],
	},
	{
		id: "environments",
		title: "Environments",
		body: "Each environment declares whether Axel may act. Cluster scope is limited to an explicit namespace allowlist.",
		points: [
			"Act and shadow modes apply per environment",
			"Shadow mode refuses every write and records the attempt",
			"Namespace allowlist bounds each cluster connector",
			"Platform engineers register and own each environment",
		],
	},
	{
		id: "operations",
		title: "Operations",
		body: "Operations show the state of the service and the work of the agent. The resolution metric is named and carries no value here.",
		points: [
			"Status page publishes current state",
			"Incidents record disruption and recovery",
			"Overview reports autonomous resolution rate",
		],
	},
];
