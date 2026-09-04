import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeArticles } from "@/db/schema";
import { type SearchAuthorizationScope, search } from "../search";

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
 * Full-text retrieval over the shared search index. The previous unescaped
 * `ILIKE '%' || message || '%'` matched every article for any message
 * containing `%`, which trapped the employee in an endless deflection.
 */
/**
 * Full-text fallback straight against the source table, for when the search
 * index holds no `knowledge_article` rows. `reconcileCoreSearchDocuments` is
 * incremental — it loads rows with `updatedAt >= since` — so on a fresh install,
 * or any deployment whose watermark advanced past the seed, published articles
 * are simply absent from the index and deflection returns nothing at all. §2.2
 * makes knowledge retrieval the first stage of intake, and a silently empty
 * first stage is worse than a slower query.
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
 * §2.2 wants the article that answers the question, not three near-misses. */
const MIN_RANK_RATIO = 0.5;

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

export async function deflectKnowledge(
	query: string,
	limit = 3,
): Promise<DeflectionArticle[]> {
	if (!query?.trim()) return [];
	const hits = await search(
		db,
		{ query, objectTypes: ["knowledge_article"], limit },
		portalKnowledgeScope,
	);
	if (!hits.length) return deflectByFullText(query, limit);

	// The index can lag an unpublish, so visibility is re-read from the source
	// of truth before anything is shown to the employee.
	const ids = hits.map((hit) => hit.objectId);
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
