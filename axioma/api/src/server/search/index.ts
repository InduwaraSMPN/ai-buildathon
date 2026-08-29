import { and, desc, inArray, type SQL, sql } from "drizzle-orm";

import type { createDb } from "@/db";
import { searchDocuments } from "@/db/schema/search";

export const SEARCH_OBJECT_TYPES = [
	"ticket",
	"problem",
	"change",
	"knowledge_article",
	"cmdb_object",
	"asset",
] as const;

export type SearchObjectType = (typeof SEARCH_OBJECT_TYPES)[number];
type Db = ReturnType<typeof createDb>;
type SearchDocumentRow = typeof searchDocuments.$inferSelect;
export type SearchDocumentInput = Omit<SearchDocumentRow, "indexedAt">;

export interface SearchResult extends SearchDocumentRow {
	rank: number;
}

export type SearchAuthorizationScope = (
	document: typeof searchDocuments,
) => SQL;

export function normalizeSearchQuery(query: string): string {
	return query.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function groupSearchResults<T extends { objectType: string }>(
	results: readonly T[],
): Record<string, T[]> {
	return results.reduce<Record<string, T[]>>((groups, result) => {
		const group = groups[result.objectType] ?? [];
		group.push(result);
		groups[result.objectType] = group;
		return groups;
	}, {});
}

/** Pure counterpart to the SQL scope intersection, useful at non-DB boundaries. */
export function retainAuthorizedResults<
	T extends { objectType: string; objectId: string },
>(results: readonly T[], authorizedKeys: ReadonlySet<string>): T[] {
	return results.filter(({ objectType, objectId }) =>
		authorizedKeys.has(`${objectType}:${objectId}`),
	);
}

export async function upsertSearchDocument(
	db: Db,
	document: SearchDocumentInput,
): Promise<void> {
	await db
		.insert(searchDocuments)
		.values(document)
		.onConflictDoUpdate({
			target: [searchDocuments.objectType, searchDocuments.objectId],
			set: {
				title: document.title,
				body: document.body,
				url: document.url,
				metadata: document.metadata,
				sourceUpdatedAt: document.sourceUpdatedAt,
				indexedAt: new Date(),
			},
			setWhere: sql`${searchDocuments.sourceUpdatedAt} <= ${document.sourceUpdatedAt}`,
		});
}

export async function search(
	db: Db,
	input: {
		query: string;
		objectTypes?: readonly SearchObjectType[];
		limit?: number;
		offset?: number;
	},
	authorizationScope: SearchAuthorizationScope,
): Promise<SearchResult[]> {
	const query = normalizeSearchQuery(input.query);
	if (!query) return [];

	const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
	const offset = Math.max(input.offset ?? 0, 0);
	const vector = sql`(
		setweight(to_tsvector('english', coalesce(${searchDocuments.title}, '')), 'A') ||
		setweight(to_tsvector('english', coalesce(${searchDocuments.body}, '')), 'B')
	)`;
	const tsquery = sql`websearch_to_tsquery('english', ${query})`;
	const scope = authorizationScope(searchDocuments);
	if (!scope)
		throw new TypeError("authorizationScope must return a SQL filter");

	return db
		.select({
			objectType: searchDocuments.objectType,
			objectId: searchDocuments.objectId,
			title: searchDocuments.title,
			body: searchDocuments.body,
			url: searchDocuments.url,
			metadata: searchDocuments.metadata,
			sourceUpdatedAt: searchDocuments.sourceUpdatedAt,
			indexedAt: searchDocuments.indexedAt,
			rank: sql<number>`ts_rank_cd(${vector}, ${tsquery})`,
		})
		.from(searchDocuments)
		.where(
			and(
				scope,
				sql`${vector} @@ ${tsquery}`,
				input.objectTypes?.length
					? inArray(searchDocuments.objectType, [...input.objectTypes])
					: undefined,
			),
		)
		.orderBy(
			desc(sql`ts_rank_cd(${vector}, ${tsquery})`),
			desc(searchDocuments.sourceUpdatedAt),
		)
		.limit(limit)
		.offset(offset);
}

export interface SearchReconciliationSource {
	objectType: SearchObjectType;
	loadChanged(since: Date): Promise<readonly SearchDocumentInput[]>;
}

/** Repairs projections missed by write paths; source loaders retain ownership of source queries. */
export async function reconcileSearchDocuments(
	db: Db,
	sources: readonly SearchReconciliationSource[],
	since: Date,
): Promise<number> {
	let indexed = 0;
	for (const source of sources) {
		const changed = await source.loadChanged(since);
		for (const document of changed) {
			if (document.objectType !== source.objectType)
				throw new TypeError(
					`Expected ${source.objectType}, got ${document.objectType}`,
				);
			await upsertSearchDocument(db, document);
			indexed++;
		}
	}
	return indexed;
}
