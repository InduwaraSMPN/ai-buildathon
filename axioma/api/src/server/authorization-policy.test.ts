import assert from "node:assert/strict";
import test from "node:test";
import { createRouterClient, ORPCError } from "@orpc/server";
import { appContract, portalContract } from "@/contracts";
import type { Capability } from "@/shared";
import * as authorizationBuilders from "./orpc";
import { appRouter } from "./routers";

const publicProcedures = new Set([
	"healthCheck",
	"readStatus",
	"listAuthProviders",
]);
const authenticatedProcedures = new Set([
	"privateData",
	"listMyDevices",
	"claimDevice",
	"releaseMyDevice",
	"listPublicKnowledge",
	"getPublicKnowledgeArticle",
	"getMyApprovalStatus",
	"listTicketFieldDefinitions",
]);
const context = (userId: string | null, capabilities: Capability[] = []) =>
	({
		auth: null,
		session: null,
		userId,
		capabilities: new Set(capabilities),
	}) as never;

const rejectsWith = async (call: () => Promise<unknown>, code: string) =>
	assert.rejects(
		call,
		(error) => error instanceof ORPCError && error.code === code,
	);

test("every composed procedure is deny-by-default", async () => {
	const anonymous = createRouterClient(appRouter, {
		context: context(null),
	}) as Record<string, (input?: unknown) => Promise<unknown>>;
	const authenticated = createRouterClient(appRouter, {
		context: context("user-with-no-capabilities"),
	}) as Record<string, (input?: unknown) => Promise<unknown>>;

	for (const name of Object.keys(appRouter)) {
		if (publicProcedures.has(name)) continue;
		await rejectsWith(
			() => (anonymous[name] as () => Promise<unknown>)(),
			"UNAUTHORIZED",
		);
		if (!authenticatedProcedures.has(name))
			await rejectsWith(
				() => (authenticated[name] as () => Promise<unknown>)(),
				"FORBIDDEN",
			);
	}
});

test("unscoped procedure builders are not exported", () => {
	assert.equal("os" in authorizationBuilders, false);
	assert.equal("authenticatedProcedure" in authorizationBuilders, false);
});

/**
 * A procedure can exist in the contract, have a handler, typecheck, and still be
 * unreachable, because `appRouter` lists its members explicitly. Nothing caught
 * that: the deny-by-default test above iterates `appRouter`, so a procedure
 * missing from it is simply never examined, and the first sign is a 404 at
 * runtime. This closes the gap from the other side.
 */
test("every contract procedure is mounted on the router", () => {
	const missing = Object.keys(appContract).filter(
		(name) => !(name in appRouter),
	);
	assert.deepEqual(missing, []);
});

test("the portal contract is a subset of the router", () => {
	const missing = Object.keys(portalContract).filter(
		(name) => !(name in appRouter),
	);
	assert.deepEqual(missing, []);
});
