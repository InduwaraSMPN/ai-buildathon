import assert from "node:assert/strict";
import { selectQueryState } from "./query-state.ts";

const error = new Error("offline");
assert.deepEqual(
	selectQueryState({
		isPending: true,
		isError: false,
		error: null,
		data: null,
	}),
	{ kind: "loading" },
);
assert.deepEqual(
	selectQueryState({ isPending: false, isError: true, error, data: ["stale"] }),
	{ kind: "content", data: ["stale"] },
);
assert.deepEqual(
	selectQueryState({
		isPending: true,
		isError: false,
		error: null,
		data: ["retained"],
	}),
	{ kind: "content", data: ["retained"] },
);
assert.deepEqual(
	selectQueryState({ isPending: false, isError: true, error, data: null }),
	{ kind: "error", error },
);
assert.deepEqual(
	selectQueryState({
		isPending: false,
		isError: false,
		error: null,
		data: null,
	}),
	{ kind: "empty" },
);
assert.deepEqual(
	selectQueryState(
		{ isPending: false, isError: false, error: null, data: [] },
		(items) => items.length === 0,
	),
	{ kind: "empty" },
);
assert.deepEqual(
	selectQueryState(
		{ isPending: false, isError: true, error, data: [] },
		(items) => items.length === 0,
	),
	{ kind: "empty" },
);
assert.deepEqual(
	selectQueryState({
		isPending: false,
		isError: false,
		error: null,
		data: { id: "ticket-1" },
	}),
	{ kind: "content", data: { id: "ticket-1" } },
);

console.log("query state validation passed");
