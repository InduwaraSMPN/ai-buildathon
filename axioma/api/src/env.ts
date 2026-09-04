import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		DATABASE_POOL_MAX: z.coerce.number().int().min(2).max(200).default(20),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		AXIOMA_PROVIDER_ENCRYPTION_KEY: z.string().optional(),
		AXIOMA_MAIL_OUTBOUND_URL: z.url().optional(),
		AXIOMA_MAIL_OUTBOUND_TOKEN: z.string().optional(),
		AXIOMA_MAIL_INBOUND_TOKEN: z.string().min(16).optional(),
		AXIOMA_DIRECTORY_SOURCE_URL: z.url().optional(),
		AXIOMA_DIRECTORY_SOURCE_TOKEN: z.string().optional(),
		AXIOMA_DIRECTORY_STAFF_ATTRIBUTE: z
			.enum(["department", "jobTitle"])
			.default("department"),
		AXIOMA_DIRECTORY_STAFF_VALUE: z.string().default("IT"),
		// Proves an AgentChannel stream is a worker the operator deployed. The
		// gateway refuses every agent connection when this is unset, because the
		// port is reachable by every enrolled laptop and the channel carries
		// ticket text, reporter identity and tool execution.
		AXIOMA_AGENT_TOKEN: z.string().min(16).optional(),
		AXIOMA_BOOTSTRAP_ADMIN_EMAIL: z
			.string()
			.trim()
			.toLowerCase()
			.pipe(z.email())
			.optional(),
		CORS_ORIGIN: z.string().min(1),
		PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
		KUBECONFIG: z.string().optional(),
		AXIOMA_K8S_CONTEXT: z.string().optional(),
		// Opt-in for an environment credential that asks to skip TLS verification.
		// Without it the request is refused and logged rather than honoured.
		AXIOMA_K8S_ALLOW_INSECURE_TLS: z
			.enum(["true", "false"])
			.default("false")
			.transform((value) => value === "true"),
		// Namespaces the cluster tools may read or patch. Empty means unrestricted,
		// which is only correct when the credential itself is namespace-scoped.
		AXIOMA_K8S_NAMESPACES: z.string().optional(),
		AXIOMA_AUTO_DISPATCH: z
			.enum(["true", "false"])
			.default("true")
			.transform((value) => value === "true"),
		AXIOMA_LLM_API_BASE: z.url().default("https://llm.marketrix.io/v1"),
		AXIOMA_LLM_KEY: z.string().optional(),
		AXIOMA_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
		// Embeddings and chat completions do not have to come from one provider,
		// and often cannot: a gateway key is frequently scoped to a list of chat
		// models and rejects `/embeddings` outright. Both of these fall back to
		// their `AXIOMA_LLM_*` counterpart, so an existing single-provider
		// deployment keeps working without setting either.
		AXIOMA_EMBEDDING_API_BASE: z.url().optional(),
		AXIOMA_EMBEDDING_KEY: z.string().optional(),
		// Set only when the embedding model's native width is not the 1536 the
		// `search_documents.embedding vector(1536)` column and its HNSW index are
		// built for. Providers that implement Matryoshka truncation (Google's
		// `gemini-embedding-001`, for one) accept this and return 1536; providers
		// that do not will reject the request rather than silently mis-size.
		AXIOMA_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().optional(),
		// Must name a model the default AXIOMA_LLM_API_BASE actually serves, or
		// intake fails its first call with an opaque gateway 400. This is the same
		// model the agent defaults to on the same endpoint, without LiteLLM's
		// `openai/` routing prefix, which a direct HTTP call does not use.
		AXIOMA_INTAKE_MODEL: z.string().default("gpt-5.6-terra"),
		AXIOMA_INTAKE_VISION: z
			.enum(["true", "false"])
			.default("false")
			.transform((v) => v === "true"),
		AXIOMA_INTAKE_TIMEOUT_MS: z.coerce
			.number()
			.int()
			.positive()
			.default(45_000),
		AXIOMA_INTAKE_MAX_TURNS: z.coerce.number().int().positive().default(20),
		AXIOMA_INTAKE_DRAFT_TTL_HOURS: z.coerce
			.number()
			.int()
			.positive()
			.default(72),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	runtimeEnv: process.env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});

/**
 * `CORS_ORIGIN` is a comma-separated list. Trimming matters: both consumers
 * match an origin by exact equality, so a value written as `a, b` yields
 * ` b`, which no browser `Origin` header can ever equal — and the failure is
 * silent, seen only as credentialed requests from that origin being blocked.
 */
export const allowedOrigins = (value = env.CORS_ORIGIN): string[] =>
	value
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);
