import { ORPCError } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import { auth } from "@/auth";
import type { Capability } from "@/shared";
import { bearerToken, createApiKeyResolver } from "./api-keys/resolver";
import { resolveCapabilities } from "./authorization";

const resolveApiKey = createApiKeyResolver();

export type CreateContextOptions = {
	context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
	const token = bearerToken(context.req.raw.headers);
	if (token) {
		const result = await resolveApiKey(token);
		if (!result.ok) {
			if (result.reason === "rate_limited")
				throw new ORPCError("TOO_MANY_REQUESTS", {
					data: { retryAfterMs: result.retryAfterMs, resetAt: result.resetAt },
				});
			throw new ORPCError("UNAUTHORIZED");
		}
		return {
			auth: result.auth,
			session: null,
			userId: result.auth.userId,
			capabilities: new Set(result.auth.capabilities as Capability[]),
		};
	}
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});
	return {
		auth: null,
		session,
		userId: session?.user.id ?? null,
		capabilities: session?.user
			? await resolveCapabilities(session.user.id)
			: new Set<Capability>(),
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
