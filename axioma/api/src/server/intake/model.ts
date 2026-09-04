import { ORPCError } from "@orpc/server";
import { env } from "@/env";

// The adapter is deliberately non-streaming: the gateway is called with
// stream:false and the router yields one terminal `complete`, which is the
// degraded case TanStack AI documents for its own non-streaming adapters. An
// SSE parser that buffered the whole body before decoding it streamed nothing
// and reported no token usage, so it was removed rather than left claiming to
// stream.

export interface IntakeModelResult {
	content: string;
	model: string;
	promptTokens: number;
	completionTokens: number;
}

export interface IntakeMessage {
	role: "system" | "user" | "assistant";
	content: string | unknown[];
}

interface ChatCompletionResponse {
	choices?: Array<{ message?: { content?: string | null } }>;
	model?: string;
	usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

export async function callIntakeModel(input: {
	system?: string;
	jsonSchema?: { name: string; schema: unknown };
	messages: IntakeMessage[];
}): Promise<IntakeModelResult> {
	if (!env.AXIOMA_LLM_KEY)
		throw new ORPCError("FORBIDDEN", {
			message: "Intake model is not configured",
		});

	const fullMessages: IntakeMessage[] = [
		...(input.system
			? [{ role: "system" as const, content: input.system }]
			: []),
		...input.messages,
	];
	const body: Record<string, unknown> = {
		model: env.AXIOMA_INTAKE_MODEL,
		messages: fullMessages,
		stream: false,
	};
	if (input.jsonSchema) {
		body.response_format = {
			type: "json_schema",
			json_schema: {
				name: input.jsonSchema.name,
				schema: input.jsonSchema.schema,
				strict: true,
			},
		};
	}

	const controller = new AbortController();
	const timeout = setTimeout(
		() => controller.abort(),
		env.AXIOMA_INTAKE_TIMEOUT_MS,
	);
	// The timeout has to outlive `fetch`: the promise resolves on headers, so
	// clearing it there leaves the body read unbounded.
	try {
		const response = await fetch(
			`${env.AXIOMA_LLM_API_BASE.replace(/\/$/, "")}/chat/completions`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.AXIOMA_LLM_KEY}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
				signal: controller.signal,
			},
		);

		if (!response.ok) {
			const detail = await response.text().catch(() => "");
			throw new ORPCError("UPSTREAM_SERVICE_ERROR", {
				message: `Intake model request failed: HTTP ${response.status} ${detail}`,
			});
		}

		// A 200 is not a promise of JSON: a gateway interstitial or a truncated
		// body arrives with one, and an unmapped SyntaxError here was treated as
		// malformed *model output* and paid for a second full-priced repair call.
		const raw = await response.text();
		let parsed: ChatCompletionResponse;
		try {
			parsed = JSON.parse(raw) as ChatCompletionResponse;
		} catch {
			throw new ORPCError("UPSTREAM_SERVICE_ERROR", {
				message: `Intake model returned a non-JSON body: ${raw.slice(0, 200)}`,
			});
		}
		return {
			content: parsed.choices?.[0]?.message?.content ?? "",
			model: parsed.model ?? env.AXIOMA_INTAKE_MODEL,
			promptTokens: parsed.usage?.prompt_tokens ?? 0,
			completionTokens: parsed.usage?.completion_tokens ?? 0,
		};
	} finally {
		clearTimeout(timeout);
	}
}
