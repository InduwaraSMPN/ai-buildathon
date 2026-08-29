import { ORPCError } from "@orpc/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps } from "@/db/schema";
import { grpcGateway } from "../grpc";
import { capabilityProcedure } from "../orpc";
import { startTicketRun } from "./shared";
import { findTicket } from "./tickets";

export async function getRun(id: string) {
	const run = (
		await db.select().from(agentRuns).where(eq(agentRuns.id, id)).limit(1)
	)[0];
	if (!run) return null;
	return {
		...run,
		steps: await db
			.select()
			.from(agentSteps)
			.where(eq(agentSteps.runId, id))
			.orderBy(asc(agentSteps.ordinal)),
	};
}

export const agentRunsRouter = {
	startRun: capabilityProcedure("run.start").startRun.handler(
		async ({ input }) => {
			const result = await startTicketRun(await findTicket(input.ticketId));
			if ("ticketId" in result) return result;
			throw new ORPCError("CONFLICT", {
				message: "Rule-settled ticket does not need an agent run",
			});
		},
	),
	getRun: capabilityProcedure("run.read").getRun.handler(({ input }) =>
		getRun(input.id),
	),
	cancelRun: capabilityProcedure("run.cancel").cancelRun.handler(
		async ({ input }) => {
			const run = (
				await db
					.select()
					.from(agentRuns)
					.where(eq(agentRuns.id, input.id))
					.limit(1)
			)[0];
			if (!run) throw new ORPCError("NOT_FOUND");
			if (run.status !== "running")
				throw new ORPCError("CONFLICT", {
					message: `Cannot cancel run in ${run.status} state`,
				});
			await grpcGateway.cancelRun(input.id, input.reason);
			const updated = (
				await db
					.select()
					.from(agentRuns)
					.where(eq(agentRuns.id, input.id))
					.limit(1)
			)[0];
			if (updated?.status !== "failed")
				throw new ORPCError("CONFLICT", {
					message: "Run changed while it was being cancelled",
				});
			return updated;
		},
	),
};
