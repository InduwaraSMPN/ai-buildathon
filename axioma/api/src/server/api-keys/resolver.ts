import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import { apiKeys } from "@/db/schema/api-keys";
import { CAPABILITIES, type Capability } from "@/shared";
import {
	type ApiKeyRecord,
	FixedWindowRateLimiter,
	parseApiKey,
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

export type ApiKeyDb = Pick<typeof defaultDb, "select" | "update">;

export function createApiKeyResolver(options?: {
	db?: ApiKeyDb;
	limiter?: FixedWindowRateLimiter;
	now?: () => Date;
}) {
	const database = options?.db ?? defaultDb;
	const limiter =
		options?.limiter ??
		new FixedWindowRateLimiter({
			perKey: 120,
			global: 2_000,
			windowMs: 60_000,
		});
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

		const rate = limiter.consume(row.id, checkedAt.getTime());
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
