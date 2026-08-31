import { join } from "node:path";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
	agentRuns,
	documentLinks,
	documents,
	knowledgeArticles,
	problems,
	searchDocuments,
	ticketMessages,
	ticketStatuses,
	tickets,
} from "@/db/schema";
import { env } from "@/env";
import { FileBlobStore } from "@/server/documents/storage";
import { createEmbedding } from "@/server/search/embeddings";
import { deidentifyKnowledgeText } from "@/server/search/projections";
import type { ToolContext } from ".";

export const KNOWLEDGE_SOURCES = [
	"known_error",
	"article",
	"resolved_ticket",
	"agent_run",
	"document",
] as const;

export const knowledgeSearchInput = z.object({
	query: z.string().trim().min(1).max(500),
	limit: z.number().int().min(1).max(20).default(8),
});

export const knowledgeFetchInput = z.object({
	source: z.enum(KNOWLEDGE_SOURCES),
	id: z.string().trim().min(1),
});

const documentStorage = new FileBlobStore(
	process.env.AXIOMA_DOCUMENT_DIR ?? join(process.cwd(), ".data", "documents"),
);
const STORED_TEXT_TYPES = new Set([
	"text/plain",
	"text/csv",
	"application/json",
]);

export function decodeStoredText(
	mediaType: string | null,
	content: Uint8Array,
) {
	const type = mediaType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
	if (!STORED_TEXT_TYPES.has(type)) return null;
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(content);
	} catch {
		return null;
	}
}

type Ranked = { source: string; id: string; rank: number };

export function publicKnowledgeItem(item: {
	source: string;
	id: string;
	reference: string;
	title: string;
	excerpt: string;
}) {
	return {
		source: item.source,
		id: item.id,
		reference: item.reference,
		title: item.title,
		excerpt: item.excerpt.slice(0, 500),
	};
}

export function reciprocalRankFusion(
	lexical: readonly Ranked[],
	semantic: readonly Ranked[],
	k = 60,
) {
	const scores = new Map<
		string,
		{ source: string; id: string; score: number }
	>();
	for (const list of [lexical, semantic])
		list.forEach((item, index) => {
			const key = `${item.source}:${item.id}`;
			const current = scores.get(key) ?? { ...item, score: 0 };
			current.score += 1 / (k + index + 1);
			scores.set(key, current);
		});
	return [...scores.values()].sort((a, b) => b.score - a.score);
}

const sourceSql = sql<string>`case ${searchDocuments.objectType}
	when 'knowledge_article' then 'article'
	else ${searchDocuments.objectType} end`;
const referenceSql = sql<string>`case ${searchDocuments.objectType}
	when 'resolved_ticket' then 'deidentified-resolved-ticket'
	when 'agent_run' then 'deidentified-agent-outcome'
	else ${searchDocuments.objectId} end`;

/** Every sensitive source is admitted in SQL before ranking or limiting. */
const accessSql = (ticketId: string) => sql`(
	(${searchDocuments.objectType} = 'knowledge_article' and exists (
		select 1 from knowledge_articles ka where ka.id = ${searchDocuments.objectId}
		and ka.status = 'published' and ka.audience in ('public', 'employees') and ka.is_restricted = false
	)) or
	(${searchDocuments.objectType} = 'known_error' and exists (
		select 1 from problems p where p.id = ${searchDocuments.objectId}
		and p.is_known_error = true and p.workaround is not null
	)) or
	(${searchDocuments.objectType} = 'resolved_ticket' and exists (
		select 1 from tickets t join ticket_statuses ts on ts.key = t.status
		where t.id = ${searchDocuments.objectId} and ts.is_closed = true and t.resolution is not null
	)) or
	(${searchDocuments.objectType} = 'agent_run' and exists (
		select 1 from agent_runs ar where ar.id = ${searchDocuments.objectId}
		and ar.status in ('resolved','escalated','failed','exhausted') and ar.outcome is not null
	)) or
	(${searchDocuments.objectType} = 'document' and exists (
		select 1 from document_links dl
		left join ticket_messages tm on dl.target_type = 'case_note' and tm.id = dl.target_id
		where dl.document_id = ${searchDocuments.objectId} and (
			(dl.target_type = 'ticket' and dl.target_id = ${ticketId}) or
			(dl.target_type = 'case_note' and tm.ticket_id = ${ticketId} and tm.visibility = 'public')
		)
	))
)`;

export async function knowledgeSearch(
	input: z.infer<typeof knowledgeSearchInput>,
	ctx: ToolContext,
	dependencies = {
		db,
		createEmbedding,
		embeddingModel: env.AXIOMA_EMBEDDING_MODEL,
	},
) {
	const embeddingPromise = dependencies.createEmbedding(input.query);
	const tsquery = sql`websearch_to_tsquery('english', ${input.query})`;
	const textVector = sql`setweight(to_tsvector('english', coalesce(${searchDocuments.title}, '')), 'A') || setweight(to_tsvector('english', coalesce(${searchDocuments.body}, '')), 'B')`;
	const candidates = Math.max(input.limit * 4, 20);
	const select = {
		source: sourceSql,
		id: searchDocuments.objectId,
		reference: referenceSql,
		title: searchDocuments.title,
		excerpt: searchDocuments.body,
		rank: sql<number>`0`,
	};
	const lexical = await dependencies.db
		.select({
			...select,
			rank: sql<number>`ts_rank_cd(${textVector}, ${tsquery})`,
		})
		.from(searchDocuments)
		.where(and(accessSql(ctx.ticketId), sql`${textVector} @@ ${tsquery}`))
		.orderBy(sql`ts_rank_cd(${textVector}, ${tsquery}) desc`)
		.limit(candidates);
	const queryEmbedding = await embeddingPromise;
	const semantic = queryEmbedding
		? await dependencies.db
				.select({
					...select,
					rank: sql<number>`1 - (${searchDocuments.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`,
				})
				.from(searchDocuments)
				.where(
					and(
						accessSql(ctx.ticketId),
						isNotNull(searchDocuments.embedding),
						eq(searchDocuments.embeddingModel, dependencies.embeddingModel),
					),
				)
				.orderBy(
					sql`${searchDocuments.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`,
				)
				.limit(candidates)
		: [];
	const byKey = new Map(
		[...lexical, ...semantic].map((item) => [
			`${item.source}:${item.id}`,
			item,
		]),
	);
	const items = reciprocalRankFusion(lexical, semantic)
		.slice(0, input.limit)
		.map(({ source, id }) => {
			const item = byKey.get(`${source}:${id}`);
			if (!item) throw new Error("knowledge rank projection missing");
			return publicKnowledgeItem({ ...item, source, id });
		});
	return {
		mode:
			queryEmbedding && semantic.length
				? ("hybrid" as const)
				: ("lexical" as const),
		items,
	};
}

export async function knowledgeFetch(
	input: z.infer<typeof knowledgeFetchInput>,
	ctx: ToolContext,
	database = db,
) {
	if (input.source === "article")
		return (
			(
				await database
					.select({
						source: sql<string>`'article'`,
						id: knowledgeArticles.id,
						title: knowledgeArticles.title,
						body: knowledgeArticles.body,
						summary: knowledgeArticles.summary,
					})
					.from(knowledgeArticles)
					.where(
						and(
							eq(knowledgeArticles.id, input.id),
							eq(knowledgeArticles.status, "published"),
							inArray(knowledgeArticles.audience, ["public", "employees"]),
							eq(knowledgeArticles.isRestricted, false),
						),
					)
					.limit(1)
			)[0] ?? null
		);
	if (input.source === "known_error")
		return (
			(
				await database
					.select({
						source: sql<string>`'known_error'`,
						id: problems.id,
						title: problems.title,
						description: problems.description,
						rootCause: problems.rootCause,
						workaround: problems.workaround,
					})
					.from(problems)
					.where(
						and(
							eq(problems.id, input.id),
							eq(problems.isKnownError, true),
							isNotNull(problems.workaround),
						),
					)
					.limit(1)
			)[0] ?? null
		);
	if (input.source === "resolved_ticket") {
		const item = (
			await database
				.select({
					source: sql<string>`'resolved_ticket'`,
					id: tickets.id,
					diagnosis: tickets.resolutionCode,
					resolution: tickets.resolution,
				})
				.from(tickets)
				.innerJoin(ticketStatuses, eq(tickets.status, ticketStatuses.key))
				.where(
					and(
						eq(tickets.id, input.id),
						eq(ticketStatuses.isClosed, true),
						isNotNull(tickets.resolution),
					),
				)
				.limit(1)
		)[0];
		return item
			? { ...item, resolution: deidentifyKnowledgeText(item.resolution ?? "") }
			: null;
	}
	if (input.source === "agent_run") {
		const item = (
			await database
				.select({
					source: sql<string>`'agent_run'`,
					id: agentRuns.id,
					status: agentRuns.status,
					outcome: agentRuns.outcome,
				})
				.from(agentRuns)
				.where(
					and(
						eq(agentRuns.id, input.id),
						inArray(agentRuns.status, [
							"resolved",
							"escalated",
							"failed",
							"exhausted",
						]),
						isNotNull(agentRuns.outcome),
					),
				)
				.limit(1)
		)[0];
		return item
			? { ...item, outcome: deidentifyKnowledgeText(item.outcome ?? "") }
			: null;
	}
	const item = (
		await database
			.select({
				source: sql<string>`'document'`,
				id: documents.id,
				title: documents.displayName,
				kind: documents.kind,
				mediaType: documents.mediaType,
				sha256: documents.sha256,
			})
			.from(documents)
			.innerJoin(documentLinks, eq(documentLinks.documentId, documents.id))
			.leftJoin(
				ticketMessages,
				and(
					eq(documentLinks.targetType, "case_note"),
					eq(ticketMessages.id, documentLinks.targetId),
				),
			)
			.where(
				and(
					eq(documents.id, input.id),
					sql`((${documentLinks.targetType} = 'ticket' and ${documentLinks.targetId} = ${ctx.ticketId}) or (${documentLinks.targetType} = 'case_note' and ${ticketMessages.ticketId} = ${ctx.ticketId} and ${ticketMessages.visibility} = 'public'))`,
				),
			)
			.limit(1)
	)[0];
	if (!item) return null;
	const text =
		item.kind === "file" && item.sha256
			? decodeStoredText(
					item.mediaType,
					await documentStorage.read(item.sha256),
				)
			: null;
	const { sha256: _, ...result } = item;
	return { ...result, text };
}
