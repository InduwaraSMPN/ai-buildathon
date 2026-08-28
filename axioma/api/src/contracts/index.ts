import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * The API contract.
 *
 * This file is the boundary between the API and its frontends, and it is
 * mirrored verbatim into `portal` and `dashboard` by `pnpm contracts:publish`.
 * That mirroring is the whole reason it exists as a separate thing from the
 * server: it must import nothing but `@orpc/contract` and `zod`, because the
 * frontends have neither a database, an auth module, nor a Hono context.
 *
 * Handlers live in `src/server/routers`. Adding a procedure means declaring it
 * here first and implementing it there — the implementation is checked against
 * this contract, so the two cannot drift.
 */

export const appContract = {
	healthCheck: oc.output(z.string()),

	privateData: oc.output(
		z.object({
			message: z.string(),
			user: z
				.object({
					id: z.string(),
					name: z.string(),
					email: z.string(),
				})
				.nullish(),
		}),
	),
};

export type AppContract = typeof appContract;
