import { ORPCError } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import { auth } from "@/auth";
import type { Capability } from "@/shared";
import { bearerToken, createApiKeyResolver } from "./api-keys/resolver";
import { assignDefaultRole, resolveCapabilities } from "./authorization";

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
		// The key's capabilities were snapshotted when it was issued, so on their
		// own they would outlive the role that granted them — an offboarded
		// administrator's key would keep `admin.*` until its TTL expired.
		// Intersecting with what the owner holds right now makes revoking the role
		// revoke the key.
		const live = await resolveCapabilities(result.auth.userId);
		if (live.size === 0) throw new ORPCError("UNAUTHORIZED");
		return {
			auth: result.auth,
			session: null,
			userId: result.auth.userId,
			capabilities: new Set(
				(result.auth.capabilities as Capability[]).filter((capability) =>
					live.has(capability),
				),
			),
		};
	}
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});
	if (!session?.user)
		return {
			auth: null,
			session,
			userId: null,
			capabilities: new Set<Capability>(),
		};
	let capabilities = await resolveCapabilities(session.user.id);
	// better-auth runs the sign-up role assignment after the user row commits, so
	// a failure there leaves an authenticated account that is forbidden from
	// every procedure and can never be re-registered. The grant is idempotent,
	// so repairing it here costs one query on an account that has no role at all.
	if (capabilities.size === 0) {
		await assignDefaultRole(
			session.user.id,
			session.user.kind === "staff" ? "staff" : "reporter",
		);
		capabilities = await resolveCapabilities(session.user.id);
	}
	return {
		auth: null,
		session,
		userId: session.user.id,
		capabilities,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
