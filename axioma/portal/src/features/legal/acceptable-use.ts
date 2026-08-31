/**
 * Acceptable use policy for the Axiōma support portal.
 *
 * This is the employee-facing document and it is deliberately not the staff
 * console's policy. That one governs people who can issue device commands and
 * approve automated work; this one governs the person raising the request, and
 * spends most of its length on what they are entitled to expect rather than on
 * what they must not do.
 *
 * The text has NOT been through legal or HR review, and the placeholders below
 * are not real. Fill them in, get the document reviewed, then set `status` to
 * an approved line and give it a real version and date: the page prints all
 * three, so a reader can always see which state they are looking at.
 */

/** Where a reader reports a problem with their own account. Replace before use. */
export const SUPPORT_CONTACT = "servicedesk@example.com";

/** The workplace policy this one sits under. Replace before use. */
export const WORKPLACE_POLICY = "the organisation's IT and workplace policies";

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
		heading: "What this portal is for",
		paragraphs: [
			"This is where you raise a support request, follow what is happening to it, and give the IT team what they need to fix it. Using it means you accept the terms below.",
			"It is provided for work. Raising a request about a personal device or a personal account is outside what the service desk can help with, and outside what this portal is licensed to handle.",
		],
	},
	{
		heading: "Your account",
		list: [
			"Your account is yours. Do not share your password, and do not raise requests from a colleague's signed-in session — the request record names whoever submitted it.",
			"If you need to raise something on someone else's behalf, say so in the request rather than signing in as them.",
			`Tell ${SUPPORT_CONTACT} straight away if you think someone else has used your account.`,
		],
	},
	{
		heading: "What you write in a request",
		paragraphs: [
			"Support staff act on what you tell them, and an inaccurate description usually costs more time than the problem did.",
		],
		list: [
			"Describe what you actually saw, including the parts that look embarrassing or like your own mistake. Nobody is judged for those and they are often the useful detail.",
			"Never put a password, a one-time code, or a payment card number into a request or an attachment. No member of the IT team will ask you for one here.",
			"Think before attaching a document that contains other people's personal data. Attach the part that shows the problem, not the whole file, where you have the choice.",
		],
	},
	{
		heading: "When IT needs to work on your device",
		paragraphs: [
			"Some fixes need the IT team to run a command on your machine, and a few need them to see or control your screen. You are entitled to know when that is happening.",
		],
		list: [
			"You will be told before anyone takes over your session, and you can decline or end it at any point.",
			"Close anything personal before you hand over the screen. A support session is not the moment to rely on a colleague looking away.",
			"Automated fixes may run without a session — those are recorded against your request, and you can ask what was run.",
		],
	},
	{
		heading: "What the IT team can see",
		paragraphs: [
			"Support staff can read the requests you raise, the messages on them, and technical information about the equipment assigned to you — enough to diagnose a fault. They do not read your mail or your files as part of that.",
			"Access is logged, and the logs are reviewed. If you believe someone looked at something they had no reason to, say so; that is exactly what the reporting route below is for.",
		],
	},
	{
		heading: "Treating the people who help you",
		paragraphs: [
			"Requests are read by colleagues. Abusive, threatening, or discriminatory language in a request or a message is treated as a workplace conduct matter, not as a support ticket.",
			"Urgency is fine and frustration is understandable. Directing it at the person reading is not.",
		],
	},
	{
		heading: "What not to ask for",
		list: [
			"Access, software, or data you are not entitled to, including access to a colleague's account or mailbox.",
			"Anything that would work around a security control, an approval step, or a licence you do not hold.",
			"Changes to someone else's equipment or permissions without their knowledge.",
			"Anything unlawful, or anything that breaches a contract or regulation the organisation is bound by.",
		],
	},
	{
		heading: "Reporting a problem with this service",
		paragraphs: [
			`If your account is compromised, if you were asked for a credential, or if something in a support session did not sit right, contact ${SUPPORT_CONTACT}. Raising it early is always the right call, including when the mistake was yours.`,
		],
	},
	{
		heading: "If this policy is breached",
		paragraphs: [
			`Misuse of this portal is handled under ${WORKPLACE_POLICY}. Access may be suspended while a serious breach is reviewed.`,
		],
	},
	{
		heading: "Changes to this policy",
		paragraphs: [
			"This document is versioned and dated above. Material changes are announced before they take effect, and continued use after that date is acceptance of the revised terms.",
		],
	},
];

export const acceptableUse = {
	title: "Acceptable use policy",
	subtitle: "Axiōma support portal",
	version: "0.1",
	status: "Draft — pending legal and HR review",
	effective: "31 August 2026",
	intro:
		"This portal is how you reach the people who fix things, and how they reach your equipment when they need to. That works on a small amount of trust in both directions. This policy sets out what is expected of you, and what you are entitled to expect back.",
	sections,
} as const;
