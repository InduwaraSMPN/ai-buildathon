import { customOpenAPIOperation } from "@orpc/openapi";
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

const documentSecurity = <T extends object>(
	middleware: T,
	capabilities?: readonly Capability[],
	capabilityMode?: "all" | "any",
) =>
	customOpenAPIOperation(middleware, (operation) => ({
		...operation,
		security: [{ bearerAuth: [] }],
		...(capabilities
			? {
					"x-required-capabilities": capabilities,
					"x-capability-mode": capabilityMode,
				}
			: {}),
	}));

const requireAuth = documentSecurity(
	os.middleware(async ({ context, next }) => {
		if (!context.userId) throw new ORPCError("UNAUTHORIZED");
		return next({ context: { ...context, userId: context.userId } });
	}),
);

export function assertCapabilities(
	context: { capabilities: ReadonlySet<Capability> },
	...required: Capability[]
): void {
	if (!hasEveryCapability(context.capabilities, required))
		throw new ORPCError("FORBIDDEN");
}

export const requireCapability = (capability: Capability) =>
	documentSecurity(
		os.middleware(async ({ context, next }) => {
			assertCapabilities(context, capability);
			return next();
		}),
		[capability],
		"all",
	);

const requireAnyCapability = (capabilities: readonly Capability[]) =>
	documentSecurity(
		os.middleware(async ({ context, next }) => {
			if (
				!capabilities.some((capability) => context.capabilities.has(capability))
			)
				throw new ORPCError("FORBIDDEN");
			return next();
		}),
		capabilities,
		"any",
	);

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
	// Possession of the code printed on the employee's own machine is the
	// authorization; no device capability is involved, because claiming is a
	// self-service act and an employee holds none.
	claimDevice: authenticatedProcedure.claimDevice,
	listPublicKnowledge: authenticatedProcedure.listPublicKnowledge,
	getPublicKnowledgeArticle: authenticatedProcedure.getPublicKnowledgeArticle,
	getMyApprovalStatus: authenticatedProcedure.getMyApprovalStatus,
	listTicketFieldDefinitions: authenticatedProcedure.listTicketFieldDefinitions,
};
