import { and, asc, desc, inArray, type SQL, sql } from "drizzle-orm";

import type { createDb } from "@/db";
import { searchDocuments } from "@/db/schema/search";
import { env } from "@/env";
import { createEmbedding } from "./embeddings";

export const SEARCH_OBJECT_TYPES = [
	"ticket",
	"problem",
	"change",
	"knowledge_article",
	"cmdb_object",
	"asset",
	"known_error",
	"resolved_ticket",
	"agent_run",
	"document",
] as const;

export type SearchObjectType = (typeof SEARCH_OBJECT_TYPES)[number];
type Db = ReturnType<typeof createDb>;
type SearchDocumentRow = typeof searchDocuments.$inferSelect;
export type SearchDocumentInput = Omit<
	SearchDocumentRow,
	"indexedAt" | "embedding" | "embeddingModel"
> &
	Partial<Pick<SearchDocumentRow, "embedding" | "embeddingModel">>;

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

export function mayEmbed(document: SearchDocumentInput): boolean {
	const { metadata } = document;
	if (typeof metadata.fetchId !== "string" || !metadata.fetchId) return false;

	switch (document.objectType) {
		case "knowledge_article":
			return (
				metadata.accessClass === "published_unrestricted" &&
				metadata.status === "published" &&
				metadata.isRestricted === false
			);
		case "known_error":
			return (
				metadata.accessClass === "published_unrestricted" &&
				metadata.isKnownError === true
			);
		case "resolved_ticket":
		case "agent_run":
			return metadata.accessClass === "deidentified";
		case "document":
			return metadata.accessClass === "current_ticket_link";
		default:
			return false;
	}
}

export async function upsertSearchDocument(
	db: Db,
	document: SearchDocumentInput,
): Promise<void> {
	const embedding = mayEmbed(document)
		? document.embedding &&
			document.embeddingModel === env.AXIOMA_EMBEDDING_MODEL
			? document.embedding
			: await createEmbedding(`${document.title}\n${document.body}`)
		: null;
	const projected = {
		...document,
		embedding,
		embeddingModel: embedding ? env.AXIOMA_EMBEDDING_MODEL : null,
	};
	await db
		.insert(searchDocuments)
		.values(projected)
		.onConflictDoUpdate({
			target: [searchDocuments.objectType, searchDocuments.objectId],
			set: {
				title: projected.title,
				body: projected.body,
				url: projected.url,
				metadata: projected.metadata,
				embedding: projected.embedding,
				embeddingModel: projected.embeddingModel,
				sourceUpdatedAt: projected.sourceUpdatedAt,
				indexedAt: new Date(),
			},
			setWhere: sql`${searchDocuments.sourceUpdatedAt} <= ${document.sourceUpdatedAt}`,
		});
}

export interface EmbeddingBackfillCursor {
	objectType: string;
	objectId: string;
}

export interface EmbeddingBackfillResult {
	scanned: number;
	updated: number;
	failed: number;
	nextCursor: EmbeddingBackfillCursor | null;
}

export async function backfillSearchEmbeddings(
	db: Db,
	limit = 100,
	cursor?: EmbeddingBackfillCursor,
	embed: (text: string) => Promise<number[] | null> = createEmbedding,
): Promise<EmbeddingBackfillResult> {
	const batchSize = Math.min(Math.max(Math.trunc(limit) || 1, 1), 1_000);
	const stale = await db
		.select()
		.from(searchDocuments)
		.where(
			and(
				sql`${searchDocuments.embedding} is null or ${searchDocuments.embeddingModel} is distinct from ${env.AXIOMA_EMBEDDING_MODEL}`,
				cursor
					? sql`(${searchDocuments.objectType}, ${searchDocuments.objectId}) > (${cursor.objectType}, ${cursor.objectId})`
					: undefined,
			),
		)
		.orderBy(asc(searchDocuments.objectType), asc(searchDocuments.objectId))
		.limit(batchSize);
	let updated = 0;
	let failed = 0;
	for (const row of stale) {
		if (!mayEmbed(row)) continue;
		const embedding = await embed(`${row.title}\n${row.body}`);
		if (!embedding) {
			failed++;
			continue;
		}
		await db
			.update(searchDocuments)
			.set({ embedding, embeddingModel: env.AXIOMA_EMBEDDING_MODEL })
			.where(
				and(
					sql`${searchDocuments.objectType} = ${row.objectType}`,
					sql`${searchDocuments.objectId} = ${row.objectId}`,
				),
			);
		updated++;
	}
	const last = stale.at(-1);
	return {
		scanned: stale.length,
		updated,
		failed,
		nextCursor: last
			? { objectType: last.objectType, objectId: last.objectId }
			: null,
	};
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
			embedding: searchDocuments.embedding,
			embeddingModel: searchDocuments.embeddingModel,
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
