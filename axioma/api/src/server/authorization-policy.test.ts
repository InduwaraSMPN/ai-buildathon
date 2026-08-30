import assert from "node:assert/strict";
import test from "node:test";
import { createRouterClient, ORPCError } from "@orpc/server";
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
