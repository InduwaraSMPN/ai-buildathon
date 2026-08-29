import assert from "node:assert/strict";
import test from "node:test";
import { ticketReadMessagesInput } from "./messages";

test("ticket message tool uses the agent wire shape", () => {
	assert.equal(
		ticketReadMessagesInput.parse({ ticket_id: "T-1" }).ticket_id,
		"T-1",
	);
	assert.equal(
		ticketReadMessagesInput.safeParse({ ticketId: "T-1" }).success,
		false,
	);
});
