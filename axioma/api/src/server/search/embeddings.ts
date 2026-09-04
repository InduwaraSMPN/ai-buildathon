import { env } from "@/env";

/** The width of `search_documents.embedding` and its HNSW index. */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Embeddings may come from a different provider than chat completions, because
 * a gateway key is often scoped to a list of chat models and rejects
 * `/embeddings` with a 403. Both settings fall back to the `AXIOMA_LLM_*` pair,
 * so a single-provider deployment needs no new configuration.
 */
const embeddingBase = () =>
	(env.AXIOMA_EMBEDDING_API_BASE ?? env.AXIOMA_LLM_API_BASE).replace(/\/$/, "");
const embeddingKey = () => env.AXIOMA_EMBEDDING_KEY ?? env.AXIOMA_LLM_KEY;

export async function createEmbedding(text: string): Promise<number[] | null> {
	const key = embeddingKey();
	if (!key) return null;
	try {
		const response = await fetch(`${embeddingBase()}/embeddings`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: env.AXIOMA_EMBEDDING_MODEL,
				input: text,
				// Only sent when configured. A provider whose model is natively
				// 1536-wide does not need it, and some reject the field outright.
				...(env.AXIOMA_EMBEDDING_DIMENSIONS
					? { dimensions: env.AXIOMA_EMBEDDING_DIMENSIONS }
					: {}),
			}),
			signal: AbortSignal.timeout(5_000),
		});
		if (!response.ok) {
			console.warn(
				`[search] embedding request failed: HTTP ${response.status}`,
			);
			return null;
		}
		const body = (await response.json()) as {
			data?: Array<{ embedding?: number[] }>;
		};
		const embedding = body.data?.[0]?.embedding;
		if (
			embedding?.length === EMBEDDING_DIMENSIONS &&
			embedding.every(Number.isFinite)
		)
			return embedding;
		// Naming the width that came back is the difference between a five-minute
		// fix and an afternoon: nearly every wrong answer here is a model whose
		// native width is not 1536, and the message used to hide that number.
		console.warn(
			`[search] embedding response was not a valid ${EMBEDDING_DIMENSIONS}-value vector (got ${
				embedding?.length ?? "none"
			}) from model ${env.AXIOMA_EMBEDDING_MODEL}`,
		);
		return null;
	} catch (error) {
		console.warn("[search] embedding request failed", error);
		return null;
	}
}
