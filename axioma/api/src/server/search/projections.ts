import { and, eq, gte, inArray, isNotNull } from "drizzle-orm";
import type { createDb } from "@/db";
import {
	agentRuns,
	assets,
	changes,
	cmdbClasses,
	cmdbObjects,
	documents,
	dynamicFields,
	dynamicFieldValues,
	knowledgeArticles,
	problems,
	ticketStatuses,
	tickets,
} from "@/db/schema";
import {
	reconcileSearchDocuments,
	type SearchDocumentInput,
	upsertSearchDocument,
} from "./index";

type Db = ReturnType<typeof createDb>;

const ticketDocument = (
	ticket: typeof tickets.$inferSelect,
): SearchDocumentInput => ({
	objectType: "ticket",
	objectId: ticket.id,
	title: ticket.number ? `${ticket.number} ${ticket.title}` : ticket.title,
	body: [ticket.body, ticket.resolution, ticket.escalationNote]
		.filter(Boolean)
		.join("\n"),
	url: `/tickets/${ticket.id}`,
	metadata: {
		status: ticket.status,
		priority: ticket.priority,
		reporterId: ticket.reporterId,
	},
	sourceUpdatedAt: ticket.updatedAt,
});

const cmdbDocument = (
	object: typeof cmdbObjects.$inferSelect,
	classKey: string,
): SearchDocumentInput => ({
	objectType: "cmdb_object",
	objectId: object.id,
	title: object.name,
	body: `${classKey} ${object.externalId}`,
	url: `/cmdb/${object.id}`,
	metadata: {
		classId: object.classId,
		classKey,
		externalId: object.externalId,
	},
	sourceUpdatedAt: object.observedAt,
});

const problemDocument = (
	problem: typeof problems.$inferSelect,
): SearchDocumentInput => ({
	objectType: "problem",
	objectId: problem.id,
	title: `${problem.problemNumber} ${problem.title}`,
	body: [problem.description, problem.rootCause, problem.workaround]
		.filter(Boolean)
		.join("\n"),
	url: `/problems/${problem.id}`,
	metadata: { status: problem.status, priority: problem.priority },
	sourceUpdatedAt: problem.updatedAt,
});

const changeDocument = (
	change: typeof changes.$inferSelect,
): SearchDocumentInput => ({
	objectType: "change",
	objectId: change.id,
	title: `${change.changeNumber} ${change.title}`,
	body: [change.description, change.reasonForChange, change.rollbackPlan]
		.filter(Boolean)
		.join("\n"),
	url: `/changes/${change.id}`,
	metadata: { status: change.status, changeType: change.changeType },
	sourceUpdatedAt: change.updatedAt,
});

export const knowledgeArticleDocument = (
	article: typeof knowledgeArticles.$inferSelect,
): SearchDocumentInput => ({
	objectType: "knowledge_article",
	objectId: article.id,
	title: article.title,
	body: [article.summary, article.body].filter(Boolean).join("\n"),
	url: `/knowledge/${article.id}`,
	metadata: {
		accessClass: "published_unrestricted",
		fetchId: article.id,
		status: article.status,
		audience: article.audience,
		isRestricted: article.isRestricted,
	},
	sourceUpdatedAt: article.updatedAt,
});

export const knownErrorDocument = (
	problem: typeof problems.$inferSelect,
): SearchDocumentInput => ({
	...problemDocument(problem),
	objectType: "known_error",
	metadata: {
		accessClass: "published_unrestricted",
		fetchId: problem.id,
		isKnownError: problem.isKnownError,
	},
});

const PII = [
	[/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]"],
	[/\b(?:https?:\/\/|www\.)\S+/gi, "[url]"],
	[/\b(?:\+?\d[\d ().-]{7,}\d)\b/g, "[phone]"],
	[/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]"],
	[/\b[A-Z0-9._-]+\\[A-Z0-9._-]+\b/gi, "[account]"],
	[/\b(?:[A-Z0-9-]+\.)+(?:local|internal|corp|lan)\b/gi, "[host]"],
	[/\b(?:INC|REQ|CHG|PRB|TASK)[-_]?\d{3,}\b/gi, "[ticket]"],
	[
		/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
		"[identifier]",
	],
] as const;

/** One name, as a capitalised word pair, allowing hyphens and apostrophes. */
const NAME = String.raw`[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)? [A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?`;

/**
 * A capitalised pair is only a person in some positions. Matching every pair
 * would eat the diagnosis — "Active Directory", "Windows Update" — so each
 * pattern carries the grammar that makes a name a name, and every candidate is
 * then checked against the technical pairs this domain's prose actually uses.
 */
const PERSON = [
	// Possessive: "Avery Chen's mailbox".
	new RegExp(String.raw`\b(${NAME})(?='s\b)`, "g"),
	// Introduced by a role, a preposition, or a verb that takes a person. The
	// lead-in tolerates a capital because it may open a sentence, but the flag
	// stays case-sensitive — `i` would make NAME's own [A-Z] match lowercase and
	// swallow the lead-in word as half the name.
	new RegExp(
		String.raw`\b(?:[Rr]eporter|[Rr]equester|[Ee]mployee|[Uu]ser|[Mm]anager|[Oo]wner|[Aa]pprover|[Aa]ssignee|[Ff]or|[Tt]o|[Ff]rom|[Bb]y|[Ww]ith|[Pp]er|[Cc]ontacted|[Cc]alled|[Ee]mailed|[Aa]ssigned to|[Ee]scalated to|[Nn]otified|[Ss]poke to|[Cc]onfirmed with|[Oo]n behalf of)\s+(${NAME})\b`,
		"g",
	),
	// Subject of a sentence: "Avery Chen reported the same fault."
	new RegExp(
		String.raw`(?:^|(?<=[.!?]\s))(${NAME})(?=\s+(?:reported|confirmed|said|asked|raised|called|replied|escalated|approved|rejected|declined|requested))`,
		"g",
	),
] as const;

/**
 * Capitalised pairs that are products, teams, or platform concepts rather than
 * people. Matched case-insensitively against the candidate alone, so the
 * surrounding grammar never rescues or condemns one of these.
 */
const NON_PERSON = new Set(
	[
		"active directory",
		"group policy",
		"windows update",
		"windows defender",
		"microsoft teams",
		"microsoft edge",
		"microsoft office",
		"outlook cache",
		"credential manager",
		"network operations",
		"service desk",
		"help desk",
		"remote desktop",
		"file explorer",
		"task scheduler",
		"device manager",
		"print spooler",
		"disk cleanup",
		"internet settings",
		"local account",
		"domain controller",
		"certificate services",
		"security centre",
		"security center",
	].map((term) => term.toLowerCase()),
);

function redactPeople(value: string): string {
	return PERSON.reduce(
		(text, pattern) =>
			text.replace(pattern, (match, candidate: string) => {
				// Every pattern captures exactly the candidate name, so what precedes
				// it — a role word, a preposition, a sentence boundary — is preserved.
				if (NON_PERSON.has(candidate.toLowerCase())) return match;
				return match.replace(candidate, "[person]");
			}),
		value,
	);
}

/** Best-effort structured-PII removal; source fields remain excluded by construction. */
export function deidentifyKnowledgeText(value: string): string {
	return PII.reduce(
		(text, [pattern, replacement]) => text.replace(pattern, replacement),
		redactPeople(value),
	)
		.replaceAll(/[\r\n\t]+/g, " ")
		.replaceAll(/\s{2,}/g, " ")
		.trim()
		.slice(0, 4_000);
}

/** Deliberately omits reporter, body, messages, and ticket number. */
export const resolvedTicketDocument = (
	ticket: typeof tickets.$inferSelect,
): SearchDocumentInput => ({
	objectType: "resolved_ticket",
	objectId: ticket.id,
	title: "De-identified resolved ticket",
	body: [
		ticket.resolutionCode && `Diagnosis: ${ticket.resolutionCode}`,
		`Resolution: ${deidentifyKnowledgeText(ticket.resolution ?? "completed")}`,
	]
		.filter(Boolean)
		.join("\n"),
	url: null,
	metadata: {
		accessClass: "deidentified",
		fetchId: ticket.id,
		resolutionCode: ticket.resolutionCode,
	},
	sourceUpdatedAt: ticket.updatedAt,
});

export const agentRunDocument = (
	run: typeof agentRuns.$inferSelect,
): SearchDocumentInput => ({
	objectType: "agent_run",
	objectId: run.id,
	title: "Prior terminal agent outcome",
	body: `Terminal run status: ${run.status}\nOutcome: ${deidentifyKnowledgeText(run.outcome ?? "")}`,
	url: null,
	metadata: {
		accessClass: "deidentified",
		fetchId: run.id,
		status: run.status,
	},
	sourceUpdatedAt: run.endedAt ?? run.startedAt,
});

/** ponytail: Documents expose safe metadata/link text only; add owned text extraction before indexing file contents. */
export const linkedDocument = (
	document: typeof documents.$inferSelect,
): SearchDocumentInput => ({
	objectType: "document",
	objectId: document.id,
	title: document.displayName,
	body: document.kind === "link" ? (document.url ?? "") : "",
	url:
		document.kind === "link" ? document.url : `/api/documents/${document.id}`,
	metadata: {
		accessClass: "current_ticket_link",
		fetchId: document.id,
		kind: document.kind,
		mediaType: document.mediaType,
	},
	sourceUpdatedAt: document.createdAt,
});

const assetDocument = (
	asset: typeof assets.$inferSelect,
	customFields: Record<string, unknown>,
): SearchDocumentInput => ({
	objectType: "asset",
	objectId: asset.id,
	title: asset.name,
	body: [
		asset.assetTag,
		asset.serialNumber,
		...Object.values(customFields).flatMap((value) =>
			Array.isArray(value) ? value : [value],
		),
	]
		.filter((value) => value !== null && value !== undefined)
		.map(String)
		.join(" "),
	url: "/assets",
	metadata: {
		...customFields,
		assetTag: asset.assetTag,
		serialNumber: asset.serialNumber,
	},
	sourceUpdatedAt: asset.updatedAt,
});

async function assetFields(db: Db, assetId: string) {
	const rows = await db
		.select({ key: dynamicFields.key, value: dynamicFieldValues.value })
		.from(dynamicFieldValues)
		.innerJoin(dynamicFields, eq(dynamicFieldValues.fieldId, dynamicFields.id))
		.where(eq(dynamicFieldValues.objectId, assetId));
	return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function indexAsset(db: Db, id: string): Promise<boolean> {
	const [asset] = await db
		.select()
		.from(assets)
		.where(eq(assets.id, id))
		.limit(1);
	if (!asset) return false;
	await upsertSearchDocument(
		db,
		assetDocument(asset, await assetFields(db, asset.id)),
	);
	return true;
}

export async function indexTicket(db: Db, id: string): Promise<boolean> {
	const [row] = await db
		.select({ ticket: tickets, isClosed: ticketStatuses.isClosed })
		.from(tickets)
		.innerJoin(ticketStatuses, eq(tickets.status, ticketStatuses.key))
		.where(eq(tickets.id, id))
		.limit(1);
	if (!row) return false;
	await upsertSearchDocument(db, ticketDocument(row.ticket));
	if (row.isClosed && row.ticket.resolution)
		await upsertSearchDocument(db, resolvedTicketDocument(row.ticket));
	return true;
}

export async function indexCmdbObject(db: Db, id: string): Promise<boolean> {
	const [row] = await db
		.select({ object: cmdbObjects, classKey: cmdbClasses.key })
		.from(cmdbObjects)
		.innerJoin(cmdbClasses, eq(cmdbObjects.classId, cmdbClasses.id))
		.where(eq(cmdbObjects.id, id))
		.limit(1);
	if (!row) return false;
	await upsertSearchDocument(db, cmdbDocument(row.object, row.classKey));
	return true;
}

export function reconcileCoreSearchDocuments(
	db: Db,
	since: Date,
): Promise<number> {
	return reconcileSearchDocuments(
		db,
		[
			{
				objectType: "ticket",
				loadChanged: async (changedSince) =>
					(
						await db
							.select()
							.from(tickets)
							.where(gte(tickets.updatedAt, changedSince))
					).map(ticketDocument),
			},
			{
				objectType: "cmdb_object",
				loadChanged: async (changedSince) =>
					(
						await db
							.select({ object: cmdbObjects, classKey: cmdbClasses.key })
							.from(cmdbObjects)
							.innerJoin(cmdbClasses, eq(cmdbObjects.classId, cmdbClasses.id))
							.where(gte(cmdbObjects.observedAt, changedSince))
					).map(({ object, classKey }) => cmdbDocument(object, classKey)),
			},
			{
				objectType: "asset",
				loadChanged: async (changedSince) =>
					Promise.all(
						(
							await db
								.select()
								.from(assets)
								.where(gte(assets.updatedAt, changedSince))
						).map(async (asset) =>
							assetDocument(asset, await assetFields(db, asset.id)),
						),
					),
			},
			{
				objectType: "problem",
				loadChanged: async (changedSince) =>
					(
						await db
							.select()
							.from(problems)
							.where(gte(problems.updatedAt, changedSince))
					).map(problemDocument),
			},
			{
				objectType: "change",
				loadChanged: async (changedSince) =>
					(
						await db
							.select()
							.from(changes)
							.where(gte(changes.updatedAt, changedSince))
					).map(changeDocument),
			},
			{
				objectType: "knowledge_article",
				loadChanged: async (changedSince) =>
					(
						await db
							.select()
							.from(knowledgeArticles)
							.where(gte(knowledgeArticles.updatedAt, changedSince))
					).map(knowledgeArticleDocument),
			},
			{
				objectType: "known_error",
				loadChanged: async (changedSince) =>
					(
						await db
							.select()
							.from(problems)
							.where(
								and(
									gte(problems.updatedAt, changedSince),
									eq(problems.isKnownError, true),
									isNotNull(problems.workaround),
								),
							)
					).map(knownErrorDocument),
			},
			{
				objectType: "resolved_ticket",
				loadChanged: async (changedSince) =>
					(
						await db
							.select({ ticket: tickets })
							.from(tickets)
							.innerJoin(ticketStatuses, eq(tickets.status, ticketStatuses.key))
							.where(
								and(
									gte(tickets.updatedAt, changedSince),
									eq(ticketStatuses.isClosed, true),
									isNotNull(tickets.resolution),
								),
							)
					).map(({ ticket }) => resolvedTicketDocument(ticket)),
			},
			{
				objectType: "agent_run",
				loadChanged: async (changedSince) =>
					(
						await db
							.select()
							.from(agentRuns)
							.where(
								and(
									gte(agentRuns.endedAt, changedSince),
									inArray(agentRuns.status, [
										"resolved",
										"escalated",
										"failed",
										"exhausted",
									]),
									isNotNull(agentRuns.outcome),
								),
							)
					).map(agentRunDocument),
			},
			{
				objectType: "document",
				loadChanged: async (changedSince) =>
					(
						await db
							.select()
							.from(documents)
							.where(gte(documents.createdAt, changedSince))
					).map(linkedDocument),
			},
		],
		since,
	);
}
