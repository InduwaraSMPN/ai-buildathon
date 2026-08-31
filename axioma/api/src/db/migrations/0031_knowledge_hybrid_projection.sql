ALTER TABLE "search_documents" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "search_documents" ADD COLUMN IF NOT EXISTS "embedding_model" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_documents_embedding_idx" ON "search_documents" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
-- Existing projections are reconciled on startup. Embeddings remain nullable so an unavailable gateway degrades safely to lexical retrieval.
