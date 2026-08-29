import { implement, ORPCError } from "@orpc/server";

import { appContract } from "@/contracts";
import type { Capability } from "@/shared";

import { hasEveryCapability } from "./authorization";
import type { Context } from "./context";

const os = implement(appContract).$context<Context>();
export const healthProcedure = { healthCheck: os.healthCheck };
export const publicProcedure = {
	readStatus: os.readStatus,
	listAuthProviders: os.listAuthProviders,
};

const requireAuth = os.middleware(async ({ context, next }) => {
	if (!context.userId) throw new ORPCError("UNAUTHORIZED");
	return next({ context: { ...context, userId: context.userId } });
});

export function assertCapabilities(
	context: { capabilities: ReadonlySet<Capability> },
	...required: Capability[]
): void {
	if (!hasEveryCapability(context.capabilities, required))
		throw new ORPCError("FORBIDDEN");
}

export const requireCapability = (capability: Capability) =>
	os.middleware(async ({ context, next }) => {
		assertCapabilities(context, capability);
		return next();
	});

const requireAnyCapability = (capabilities: readonly Capability[]) =>
	os.middleware(async ({ context, next }) => {
		if (
			!capabilities.some((capability) => context.capabilities.has(capability))
		)
			throw new ORPCError("FORBIDDEN");
		return next();
	});

const authenticatedProcedure = os.use(requireAuth);
export const privateDataProcedure = {
	privateData: authenticatedProcedure.privateData,
};
export const capabilityProcedure = (capability: Capability) =>
	authenticatedProcedure.use(requireCapability(capability));
export const anyCapabilityProcedure = (...capabilities: Capability[]) =>
	authenticatedProcedure.use(requireAnyCapability(capabilities));
export const reporterProcedure = {
	listMyDevices: authenticatedProcedure.listMyDevices,
	listPublicKnowledge: authenticatedProcedure.listPublicKnowledge,
	getPublicKnowledgeArticle: authenticatedProcedure.getPublicKnowledgeArticle,
	getMyApprovalStatus: authenticatedProcedure.getMyApprovalStatus,
};
