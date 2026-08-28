import { implement, ORPCError } from "@orpc/server";

import { appContract } from "@/contracts";

import type { Context } from "./context";

/**
 * Server-side procedure builders, bound to the contract.
 *
 * `implement` ties handlers to `appContract`, so a handler whose output stops
 * matching the declared schema fails to typecheck here rather than at runtime in
 * a frontend that mirrored a contract the server no longer honours.
 */
export const os = implement(appContract).$context<Context>();

export const publicProcedure = os;

const requireAuth = os.middleware(async ({ context, next }) => {
	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return next({ context: { session: context.session } });
});

export const protectedProcedure = os.use(requireAuth);
