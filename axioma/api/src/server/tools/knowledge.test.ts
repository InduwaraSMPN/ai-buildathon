import assert from "node:assert/strict";
import test from "node:test";
import { knowledgeSearchInput } from "./knowledge";

test("knowledge search uses the shared limit contract", () => {
	assert.equal(
		knowledgeSearchInput.parse({ query: "VPN DNS failure" }).limit,
		8,
	);
	assert.equal(
		knowledgeSearchInput.parse({ query: "VPN DNS failure", limit: 20 }).limit,
		20,
	);
	assert.equal(
		knowledgeSearchInput.safeParse({ query: "VPN DNS failure", limit: 21 })
			.success,
		false,
	);
});
