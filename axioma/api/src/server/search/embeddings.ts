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
		if (embedding?.length === 1536 && embedding.every(Number.isFinite))
			return embedding;
		console.warn(
			"[search] embedding response was missing a valid 1536-value vector",
		);
		return null;
	} catch (error) {
		console.warn("[search] embedding request failed", error);
		return null;
	}
}
