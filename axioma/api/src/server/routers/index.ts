import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../orpc";

export const appRouter = {
	healthCheck: publicProcedure.healthCheck.handler(() => "OK"),

	privateData: protectedProcedure.privateData.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
