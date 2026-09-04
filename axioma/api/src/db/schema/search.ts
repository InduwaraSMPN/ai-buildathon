import { sql } from "drizzle-orm";
import {
	index,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	vector,
} from "drizzle-orm/pg-core";

/** Denormalized, authorization-neutral search projection. Authorization is applied at query time. */
export const searchReconciliationState = pgTable(
	"search_reconciliation_state",
	{
		key: text("key").primaryKey(),
		lastReconciledAt: timestamp("last_reconciled_at").defaultNow().notNull(),
	},
);

export const searchDocuments = pgTable(
	"search_documents",
	{
		objectType: text("object_type").notNull(),
		objectId: text("object_id").notNull(),
		title: text("title").notNull(),
		body: text("body").notNull().default(""),
		url: text("url"),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		// OpenAI text-embedding-3-small dimensions; null keeps lexical retrieval usable.
		embedding: vector("embedding", { dimensions: 1536 }),
		embeddingModel: text("embedding_model"),
		sourceUpdatedAt: timestamp("source_updated_at").notNull(),
		indexedAt: timestamp("indexed_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.objectType, t.objectId] }),
		index("search_documents_fts_idx").using(
			"gin",
			sql`(
				setweight(to_tsvector('english', coalesce(${t.title}, '')), 'A') ||
				setweight(to_tsvector('english', coalesce(${t.body}, '')), 'B')
			)`,
		),
		index("search_documents_changed_idx").on(t.objectType, t.sourceUpdatedAt),
		// Every vector query carries mandatory non-vector predicates, so a single
		// unpartitioned HNSW index was either ignored by the planner or
		// post-filtered: the 40 global nearest neighbours are dominated by
		// `agent_run` rows, which the portal's deflection never wants. One index
		// per scope keeps the index aligned with the predicate.
		index("search_documents_embedding_article_idx")
			.using("hnsw", t.embedding.op("vector_cosine_ops"))
			.where(sql`${t.objectType} = 'knowledge_article'`),
		index("search_documents_embedding_agent_idx")
			.using("hnsw", t.embedding.op("vector_cosine_ops"))
			.where(
				sql`${t.objectType} in ('resolved_ticket', 'agent_run', 'known_error', 'document')`,
			),
		// `portalKnowledgeScope` filters on three `->>` extractions and nothing
		// indexed `metadata` at all.
		index("search_documents_metadata_idx").using(
			"gin",
			sql`${t.metadata} jsonb_path_ops`,
		),
	],
);
