import assert from "node:assert/strict";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { invalidateTicketQueries } from "./query-behavior.ts";

const orpc = createTanstackQueryUtils(
	new Proxy({}, { get: () => () => undefined }),
);
const calls = [];
const queryClient = {
	invalidateQueries(options) {
		calls.push(options.queryKey);
		return Promise.resolve();
	},
};

await invalidateTicketQueries(queryClient, orpc, "ticket-7");

assert.deepEqual(calls, [
	orpc.listTickets.key(),
	orpc.getTicket.key({ input: { id: "ticket-7" } }),
	orpc.listTicketSla.key({ input: { ticketId: "ticket-7" } }),
]);
assert.equal(calls.length, 3);
assert.notDeepEqual(calls[0], orpc.key());

console.log("ticket query invalidation validation passed");
