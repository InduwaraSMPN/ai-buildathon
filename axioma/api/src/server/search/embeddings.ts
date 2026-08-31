import { env } from "@/env";

export async function createEmbedding(text: string): Promise<number[] | null> {
	if (!env.AXIOMA_LLM_KEY) return null;
	try {
		const response = await fetch(
			`${env.AXIOMA_LLM_API_BASE.replace(/\/$/, "")}/embeddings`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.AXIOMA_LLM_KEY}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: env.AXIOMA_EMBEDDING_MODEL,
					input: text,
				}),
				signal: AbortSignal.timeout(5_000),
			},
		);
		if (!response.ok) return null;
		const body = (await response.json()) as {
			data?: Array<{ embedding?: number[] }>;
		};
		const embedding = body.data?.[0]?.embedding;
		return embedding?.length === 1536 && embedding.every(Number.isFinite)
			? embedding
			: null;
	} catch {
		return null;
	}
}
