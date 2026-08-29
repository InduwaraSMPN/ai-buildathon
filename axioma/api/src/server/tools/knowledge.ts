import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { knowledgeArticles } from "@/db/schema/knowledge";
import { problems } from "@/db/schema/problems";

export const knowledgeSearchInput = z.object({
	query: z.string().trim().min(1).max(500),
	limit: z.number().int().min(1).max(20).default(8),
});

export async function knowledgeSearch(
	input: z.infer<typeof knowledgeSearchInput>,
) {
	const tsquery = sql`websearch_to_tsquery('english', ${input.query})`;
	const problemVector = sql`to_tsvector('english', coalesce(${problems.title}, '') || ' ' || coalesce(${problems.description}, '') || ' ' || coalesce(${problems.rootCause}, '') || ' ' || coalesce(${problems.workaround}, ''))`;
	const articleVector = sql`to_tsvector('english', coalesce(${knowledgeArticles.title}, '') || ' ' || coalesce(${knowledgeArticles.summary}, '') || ' ' || coalesce(${knowledgeArticles.body}, ''))`;

	const [knownErrors, articles] = await Promise.all([
		db
			.select({
				source: sql<"known_error">`'known_error'`,
				id: problems.id,
				reference: problems.problemNumber,
				title: problems.title,
				excerpt: problems.description,
				workaround: problems.workaround,
				rank: sql<number>`ts_rank_cd(${problemVector}, ${tsquery})`,
			})
			.from(problems)
			.where(
				and(
					eq(problems.isKnownError, true),
					isNotNull(problems.workaround),
					sql`${problemVector} @@ ${tsquery}`,
				),
			)
			.orderBy(desc(sql`ts_rank_cd(${problemVector}, ${tsquery})`))
			.limit(input.limit),
		db
			.select({
				source: sql<"article">`'article'`,
				id: knowledgeArticles.id,
				reference: knowledgeArticles.id,
				title: knowledgeArticles.title,
				excerpt: sql<string>`coalesce(${knowledgeArticles.summary}, ${knowledgeArticles.body})`,
				workaround: sql<null>`null`,
				rank: sql<number>`ts_rank_cd(${articleVector}, ${tsquery})`,
			})
			.from(knowledgeArticles)
			.where(
				and(
					eq(knowledgeArticles.status, "published"),
					eq(knowledgeArticles.isRestricted, false),
					sql`${articleVector} @@ ${tsquery}`,
				),
			)
			.orderBy(desc(sql`ts_rank_cd(${articleVector}, ${tsquery})`))
			.limit(input.limit),
	]);

	const items = [...knownErrors, ...articles]
		.sort((a, b) => b.rank - a.rank)
		.slice(0, input.limit)
		.map(({ rank: _rank, workaround, excerpt, ...item }) => ({
			...item,
			excerpt: excerpt.slice(0, 500),
			...(workaround ? { workaround } : {}),
		}));

	return { mode: "lexical" as const, items };
}
