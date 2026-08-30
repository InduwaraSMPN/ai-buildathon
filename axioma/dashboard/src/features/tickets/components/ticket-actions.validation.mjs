import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
	new URL("./ticket-actions.tsx", import.meta.url),
	"utf8",
);

assert.match(source, /handledHash\.current\.ticketId !== ticket\.id/);
assert.match(source, /history\.replaceState\(\s*history\.state/);
assert.match(source, /\[canAssign, canReclassify, canResolve, ticket\.id\]/);

console.log("ticket action hash validation passed");
