import assert from "node:assert/strict";
import test from "node:test";
import z from "zod";
import { createTicketFormSchemas, submitThenReset } from "./form-validation.ts";

const {
	addDetail: addDetailSchema,
	csat: csatSchema,
	reply: replySchema,
} = createTicketFormSchemas(z);

test("validates replies and resets only after successful submission", async () => {
	assert.equal(replySchema.safeParse({ body: "   " }).success, false);
	assert.equal(replySchema.safeParse({ body: " reply " }).success, true);
	assert.equal(
		replySchema.safeParse({ body: "x".repeat(10_001) }).success,
		false,
	);

	const successCalls = [];
	const result = await submitThenReset(
		async () => {
			successCalls.push("submit");
			return "saved";
		},
		() => successCalls.push("reset"),
	);
	assert.equal(result, "saved");
	assert.deepEqual(successCalls, ["submit", "reset"]);

	const failureCalls = [];
	await assert.rejects(
		submitThenReset(
			async () => {
				failureCalls.push("submit");
				throw new Error("failed");
			},
			() => failureCalls.push("reset"),
		),
	);
	assert.deepEqual(failureCalls, ["submit"]);
});

test("validates CSAT ratings and comments", () => {
	for (const rating of [1, 2, 3, 4, 5]) {
		assert.equal(csatSchema.safeParse({ rating, comment: "" }).success, true);
	}
	for (const rating of [0, 6, 1.5]) {
		assert.equal(csatSchema.safeParse({ rating, comment: "" }).success, false);
	}
	assert.equal(
		csatSchema.safeParse({ rating: 5, comment: "x".repeat(2_001) }).success,
		false,
	);
});

test("validates added details, then resets and closes", async () => {
	assert.equal(addDetailSchema.safeParse({ note: "  " }).success, false);
	assert.equal(
		addDetailSchema.safeParse({ note: " more detail " }).success,
		true,
	);
	assert.equal(
		addDetailSchema.safeParse({ note: "x".repeat(2_001) }).success,
		false,
	);

	const calls = [];
	await submitThenReset(
		async () => calls.push("submit"),
		() => calls.push("reset"),
		() => calls.push("close"),
	);
	assert.deepEqual(calls, ["submit", "reset", "close"]);
});
