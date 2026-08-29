import assert from "node:assert/strict";
import test from "node:test";
import { type TicketMessage, toPortalMessages } from "./messages";

const message = (visibility: TicketMessage["visibility"]): TicketMessage => ({
	id: visibility,
	ticketId: "ticket-1",
	authorId: "user-1",
	authorType: "staff",
	body: `${visibility} note`,
	visibility,
	createdAt: new Date(0),
});

test("portal message shape cannot include private messages or visibility", () => {
	assert.deepEqual(toPortalMessages([message("private"), message("public")]), [
		{
			id: "public",
			ticketId: "ticket-1",
			authorId: "user-1",
			authorType: "staff",
			body: "public note",
			createdAt: new Date(0),
		},
	]);
});
