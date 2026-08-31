/**
 * Acceptable use policy for the Axiōma staff console.
 *
 * The obligations below are written against what this console can actually do
 * — issue device commands, take over a session, read ticket transcripts and
 * mail logs, approve automated work — rather than generic IT boilerplate. The
 * text has NOT been through legal or HR review, and the two placeholders below
 * are not real. Fill them in, get the document reviewed, then set `status` to
 * an approved line and give it a real version and date: the page prints all
 * three, so a reader can always see which state they are looking at.
 */

/** Where a reader reports misuse or a compromised account. Replace before use. */
export const SECURITY_CONTACT = "security@example.com";

/** The disciplinary policy this one defers to. Replace before use. */
export const DISCIPLINARY_POLICY = "the organisation's disciplinary policy";

export type PolicySection = {
	readonly heading: string;
	readonly paragraphs?: readonly string[];
	readonly list?: readonly string[];
};

// Annotated rather than `as const`, so every section widens to the optional
// `paragraphs`/`list` shape instead of narrowing to whichever keys it happens
// to use — the renderer maps over one uniform type.
const sections: readonly PolicySection[] = [
	{
		heading: "Who this applies to",
		paragraphs: [
			"Everyone holding a staff account on the Axiōma console, including employees, contractors, and vendor staff issued an account for a specific engagement. It applies whenever you use the console, on any device and any network, inside or outside working hours.",
			"Using the console means you accept these terms. If you cannot accept them, do not sign in.",
		],
	},
	{
		heading: "Use the access your role was given",
		paragraphs: [
			"Your account carries a set of capabilities. They describe the work your role is expected to do, and they are the boundary of your authorisation — not a technical obstacle to route around.",
		],
		list: [
			"Do not sign in as another person, share your account, or leave an authenticated session open for someone else to use.",
			"Do not use a shared or service account to do work your own account is not permitted to do.",
			"If you need a capability you do not hold, ask for it to be granted. Do not borrow one.",
		],
	},
	{
		heading: "Your account and credentials",
		list: [
			"One account, one person. Passwords and identity-provider sessions are not to be shared, written into a ticket, or stored in a shared document.",
			"Sign in only through this console's own sign-in page or a configured identity provider.",
			"Report a lost device, a suspected compromise, or an unexpected sign-in immediately — before you investigate it yourself.",
		],
	},
	{
		heading: "Acting on someone's device",
		paragraphs: [
			"Device commands and session takeover are the most intrusive things this console can do, and they happen on equipment a colleague is using.",
		],
		list: [
			"Act only where a ticket, change, or approval record justifies the action, and only for that purpose.",
			"Take the least intrusive step that resolves the issue. Where a typed command will do the work, do not escalate to taking over the session.",
			"Tell the person before you take over their session, and stop when they ask you to.",
			"Never use device access to observe a colleague outside the specific request you are working.",
		],
	},
	{
		heading: "Records, evidence, and personal data",
		paragraphs: [
			"Tickets, agent transcripts, mail logs, asset records, and configuration data describe real people and confidential systems. Access is granted for the work, not for interest.",
		],
		list: [
			"Read what the request in front of you requires, and no more. Curiosity about a colleague's record is misuse, whether or not you act on what you find.",
			"Do not export or copy records out of the console except where a documented process calls for it.",
			"Do not paste confidential content into external tools or services that have not been approved for it.",
		],
	},
	{
		heading: "Automated and AI-assisted work",
		paragraphs: [
			"Agent runs, ticket rules, and workflows take real action. When you approve a proposed action, the decision and its consequences are yours, not the automation's.",
		],
		list: [
			"Read what an automation proposes, and the evidence it gathered, before approving it.",
			"Do not configure a rule, workflow, or connector to bypass an approval gate or a capability check.",
			"Where the process requires a second person to approve, do not approve your own work.",
		],
	},
	{
		heading: "Sending mail",
		paragraphs: [
			"Mailboxes and templates in this console send on the organisation's behalf and appear to the recipient as official communication. Send what the request calls for, to the people it concerns, and nothing else.",
		],
	},
	{
		heading: "Monitoring and audit",
		paragraphs: [
			"Console activity is recorded: sign-ins, records read and changed, device commands issued, mail sent, approvals granted, and automated runs. These logs are retained and reviewed for security, compliance, and quality purposes. Continued use of the console is your acknowledgement of that monitoring.",
		],
	},
	{
		heading: "Prohibited without exception",
		list: [
			"Sharing an account or an authenticated session.",
			"Opening records unrelated to work you are actually doing.",
			"Issuing a device command or taking over a session with no justifying ticket, change, or approval.",
			"Disabling, evading, or tampering with logging, approval gates, or capability checks.",
			"Extracting records in bulk without written authorisation.",
			"Connecting an unapproved integration, connector, or identity provider.",
			"Using console access for personal benefit, for curiosity, or on behalf of anyone outside the organisation.",
			"Any use that is unlawful, or that breaches a contract or regulation the organisation is bound by.",
		],
	},
	{
		heading: "Reporting",
		paragraphs: [
			`Report suspected misuse, a compromised account, or an action you took in error to ${SECURITY_CONTACT}. Reporting your own mistake promptly is expected of you and is treated as such — the damage from a concealed error is almost always larger than the error.`,
		],
	},
	{
		heading: "If this policy is breached",
		paragraphs: [
			`Access may be suspended immediately while a breach is reviewed. Confirmed misuse is handled under ${DISCIPLINARY_POLICY}, and may lead to termination of employment or contract, and to referral to a regulator or law enforcement where the law requires it.`,
		],
	},
	{
		heading: "Changes to this policy",
		paragraphs: [
			"This document is versioned and dated above. Material changes are announced to console users before they take effect, and continued use after that date is acceptance of the revised terms.",
		],
	},
];

export const acceptableUse = {
	title: "Acceptable use policy",
	subtitle: "Axiōma IT operations console",
	version: "1.0",
	status: "Approved",
	effective: "31 August 2026",
	intro:
		"This console carries real authority. From it you can read another person's support history, issue a command to their laptop, take over their session, send mail on the organisation's behalf, and approve work an automation has proposed. This policy sets out the terms on which that authority is lent to you.",
	sections,
} as const;
