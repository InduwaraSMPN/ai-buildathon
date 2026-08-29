import { eq, sql } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import { apiKeys } from "@/db/schema/api-keys";
import { CAPABILITIES, type Capability } from "@/shared";
import {
	type ApiKeyRecord,
	parseApiKey,
	type RateLimitResult,
	verifyApiKeySecret,
} from "./core";

export type ApiKeyAuth = {
	kind: "api-key";
	keyId: string;
	userId: string;
	capabilities: Capability[];
};

export type ApiKeyResolution =
	| { ok: true; auth: ApiKeyAuth; remaining: number; resetAt: Date }
	| {
			ok: false;
			reason: "invalid" | "expired" | "revoked" | "rate_limited";
			retryAfterMs?: number;
			resetAt?: Date;
	  };

export type ApiKeyDb = Pick<typeof defaultDb, "select" | "update" | "execute">;
export type RateLimitConsumer = (
	keyId: string,
	now: Date,
) => Promise<RateLimitResult>;

export const consumeDatabaseRateLimit =
	(database: Pick<typeof defaultDb, "execute">): RateLimitConsumer =>
	async (keyId, now) => {
		if (!keyId || !Number.isFinite(now.getTime()))
			throw new Error("Invalid rate-limit input");
		const result = await database.execute(
			sql<{
				allowed: boolean;
				remaining: number;
				reset_at: Date;
				retry_after_ms: number;
			}>`select * from consume_api_rate_limit(${keyId}, ${now})`,
		);
		const row = result.rows[0];
		if (!row) throw new Error("Rate-limit policy is not configured");
		const resetAt = new Date(row.reset_at as string | number | Date);
		return row.allowed
			? { allowed: true, remaining: Number(row.remaining), resetAt }
			: {
					allowed: false,
					remaining: 0,
					resetAt,
					retryAfterMs: Number(row.retry_after_ms),
				};
	};

export function createApiKeyResolver(options?: {
	db?: ApiKeyDb;
	consumeRateLimit?: RateLimitConsumer;
	now?: () => Date;
}) {
	const database = options?.db ?? defaultDb;
	const consumeRateLimit =
		options?.consumeRateLimit ?? consumeDatabaseRateLimit(database);
	const now = options?.now ?? (() => new Date());

	return async (token: string): Promise<ApiKeyResolution> => {
		const parsed = parseApiKey(token);
		if (!parsed) return { ok: false, reason: "invalid" };

		const [row] = await database
			.select()
			.from(apiKeys)
			.where(eq(apiKeys.prefix, parsed.prefix))
			.limit(1);
		if (!row || !verifyApiKeySecret(parsed.secret, row.secretHash)) {
			return { ok: false, reason: "invalid" };
		}

		const checkedAt = now();
		if (row.revokedAt) return { ok: false, reason: "revoked" };
		if (row.expiresAt <= checkedAt) return { ok: false, reason: "expired" };

		const rate = await consumeRateLimit(row.id, checkedAt);
		if (!rate.allowed) {
			return {
				ok: false,
				reason: "rate_limited",
				retryAfterMs: rate.retryAfterMs,
				resetAt: rate.resetAt,
			};
		}

		await database
			.update(apiKeys)
			.set({ lastUsedAt: checkedAt })
			.where(eq(apiKeys.id, row.id));
		return {
			ok: true,
			auth: toApiKeyAuth(row),
			remaining: rate.remaining,
			resetAt: rate.resetAt,
		};
	};
}

export function bearerToken(headers: Headers): string | null {
	const authorization = headers.get("authorization");
	const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? "");
	return match?.[1] ?? null;
}

export function toApiKeyAuth(
	key: Pick<ApiKeyRecord, "id" | "userId" | "capabilities">,
): ApiKeyAuth {
	return {
		kind: "api-key",
		keyId: key.id,
		userId: key.userId,
		capabilities: key.capabilities.filter((value): value is Capability =>
			(CAPABILITIES as readonly string[]).includes(value),
		),
	};
}
