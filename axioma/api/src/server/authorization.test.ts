import assert from "node:assert/strict";
import test from "node:test";
import { ORPCError } from "@orpc/server";
import type { Capability } from "@/shared";
import { hasEveryCapability } from "./authorization";
import { assertCapabilities } from "./orpc";

test("capability checks require the complete requested set", () => {
	const effective = new Set<Capability>(["ticket.read.own", "ticket.create"]);
	assert.equal(hasEveryCapability(effective, ["ticket.read.own"]), true);
	assert.equal(
		hasEveryCapability(effective, ["ticket.read.own", "ticket.close"]),
		false,
	);
});

test("missing ticket.close is forbidden", () => {
	assert.throws(
		() =>
			assertCapabilities(
				{ capabilities: new Set<Capability>(["ticket.read.own"]) } as never,
				"ticket.close",
			),
		(error) => error instanceof ORPCError && error.code === "FORBIDDEN",
	);
});
