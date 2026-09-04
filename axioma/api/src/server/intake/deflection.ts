import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeArticles, searchDocuments } from "@/db/schema";
import { env } from "@/env";
import { type SearchAuthorizationScope, search } from "../search";
import { createEmbedding } from "../search/embeddings";
import { reciprocalRankFusion } from "../tools/knowledge";

export interface DeflectionArticle {
	id: string;
	title: string;
	summary: string | null;
}

/**
 * The projection carries the article's visibility in its metadata, so the scope
 * is the indexed mirror of `knowledgeRouter.listPublicKnowledge`.
 */
const portalKnowledgeScope: SearchAuthorizationScope = (document) =>
	sql`${document.objectType} = 'knowledge_article'
		and ${document.metadata} ->> 'status' = 'published'
		and ${document.metadata} ->> 'audience' = 'public'
		and ${document.metadata} ->> 'isRestricted' = 'false'`;

/**
 * Full-text fallback straight against the source table, for when the search
 * index holds no `knowledge_article` rows. `reconcileCoreSearchDocuments` is
 * incremental — it loads rows with `updatedAt >= since` — so on a fresh install,
 * or any deployment whose watermark advanced past the seed, published articles
 * are simply absent from the index and deflection returns nothing at all.
 * Knowledge retrieval is the first stage of intake, and a first stage that is
 * silently empty is worse than one that runs a slower query.
 *
 * `websearch_to_tsquery` is parameterised, so this is not a return of the
 * unescaped `ILIKE '%' || message || '%'` this module used to run.
 */
/**
 * Employees write sentences, not keywords. `websearch_to_tsquery` ANDs bare
 * terms, so "my laptop will not connect to the office wifi any more" matches an
 * article only if every one of those words appears in it — which is close to
 * never. The terms are therefore OR-ed and the results ranked, so the best
 * article wins rather than the only exhaustively-matching one. Short words are
 * dropped because they rank noise, and a rank floor keeps an unrelated message
 * deflecting to nothing.
 */
const MIN_TERM_LENGTH = 3;
/** Absolute floor, calibrated against the seeded corpus: a single incidental
 * word match ranks around 0.010 and a real topical match around 0.034. */
const MIN_RANK = 0.02;
/** Relative floor. An absolute threshold alone does not travel between corpora,
 * so a hit also has to be at least this good compared with the best hit —
 * deflection should offer the one article that answers the question, not three
 * near-misses. */
const MIN_RANK_RATIO = 0.5;
/** Cosine floor for the vector branch. Below this the nearest neighbour is
 * simply the least-unrelated article, which is not an answer. */
const MIN_SIMILARITY = 0.25;

export function deflectionTerms(query: string): string[] {
	return [
		...new Set(
			query
				.toLowerCase()
				.split(/[^\p{L}\p{N}]+/u)
				.filter((word) => word.length >= MIN_TERM_LENGTH),
		),
	];
}

async function deflectByFullText(
	query: string,
	limit: number,
): Promise<DeflectionArticle[]> {
	const terms = deflectionTerms(query);
	if (!terms.length) return [];
	// Joined with websearch's own `or`, and passed as a bound parameter — this is
	// not a return of the unescaped `ILIKE` this module used to run.
	const tsquery = sql`websearch_to_tsquery('english', ${terms.join(" or ")})`;
	const haystack = sql`to_tsvector('english',
		${knowledgeArticles.title} || ' ' ||
		coalesce(${knowledgeArticles.summary}, '') || ' ' ||
		${knowledgeArticles.body}
	)`;
	const rank = sql<number>`ts_rank(${haystack}, ${tsquery})`;
	const hits = await db
		.select({
			id: knowledgeArticles.id,
			title: knowledgeArticles.title,
			summary: knowledgeArticles.summary,
			rank,
		})
		.from(knowledgeArticles)
		.where(
			and(
				eq(knowledgeArticles.status, "published"),
				eq(knowledgeArticles.audience, "public"),
				eq(knowledgeArticles.isRestricted, false),
				sql`${haystack} @@ ${tsquery}`,
				sql`${rank} >= ${MIN_RANK}`,
			),
		)
		.orderBy(sql`${rank} desc`)
		.limit(limit);
	const best = hits[0]?.rank ?? 0;
	return hits
		.filter((hit) => hit.rank >= best * MIN_RANK_RATIO)
		.map(({ id, title, summary }) => ({ id, title, summary }));
}

/**
 * Nearest neighbours over the same projection the lexical path reads, scoped
 * identically. `server/search`'s `search()` selects the embedding column but
 * never uses it — it is lexical only — so semantic recall has to be asked for
 * here. Rows are gated on the embedding having been produced by the *current*
 * model, because a vector from a different model is not comparable.
 */
async function deflectBySimilarity(
	query: string,
	limit: number,
): Promise<string[]> {
	const queryEmbedding = await createEmbedding(query);
	if (!queryEmbedding) return [];
	const literal = sql`${JSON.stringify(queryEmbedding)}::vector`;
	const rows = await db
		.select({ objectId: searchDocuments.objectId })
		.from(searchDocuments)
		.where(
			and(
				portalKnowledgeScope(searchDocuments),
				isNotNull(searchDocuments.embedding),
				eq(searchDocuments.embeddingModel, env.AXIOMA_EMBEDDING_MODEL),
				sql`1 - (${searchDocuments.embedding} <=> ${literal}) >= ${MIN_SIMILARITY}`,
			),
		)
		.orderBy(sql`${searchDocuments.embedding} <=> ${literal}`)
		.limit(limit);
	return rows.map((row) => row.objectId);
}

export async function deflectKnowledge(
	query: string,
	limit = 3,
): Promise<DeflectionArticle[]> {
	if (!query?.trim()) return [];
	// Hybrid, on the pattern `server/tools/knowledge.ts` already uses for the
	// agent: lexical catches the exact words, the vector catches an employee who
	// describes the problem without using any of them, and reciprocal rank
	// fusion merges the two orderings without tuning a weight.
	const [lexicalHits, semanticIds] = await Promise.all([
		search(
			db,
			{ query, objectTypes: ["knowledge_article"], limit },
			portalKnowledgeScope,
		),
		deflectBySimilarity(query, limit),
	]);
	const ranked = reciprocalRankFusion(
		lexicalHits.map((hit, index) => ({
			source: "article",
			id: hit.objectId,
			rank: lexicalHits.length - index,
		})),
		semanticIds.map((id, index) => ({
			source: "article",
			id,
			rank: semanticIds.length - index,
		})),
	);
	// Nothing indexed at all — a fresh install whose projection watermark ran
	// past the seed. Fall back to the source table so the stage still works.
	if (!ranked.length) return deflectByFullText(query, limit);

	// The index can lag an unpublish, so visibility is re-read from the source
	// of truth before anything is shown to the employee.
	const ids = ranked.slice(0, limit).map((hit) => hit.id);
	const visible = await db
		.select({
			id: knowledgeArticles.id,
			title: knowledgeArticles.title,
			summary: knowledgeArticles.summary,
		})
		.from(knowledgeArticles)
		.where(
			and(
				inArray(knowledgeArticles.id, ids),
				eq(knowledgeArticles.status, "published"),
				eq(knowledgeArticles.audience, "public"),
				eq(knowledgeArticles.isRestricted, false),
			),
		);
	const byId = new Map(visible.map((article) => [article.id, article]));
	return ids
		.map((id) => byId.get(id))
		.filter((article): article is DeflectionArticle => Boolean(article));
}
