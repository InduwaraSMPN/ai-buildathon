import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
	new URL("./overview-widgets.tsx", import.meta.url),
	"utf8",
);

assert.match(source, /scope: \{ id: "dashboard-arrangement" \}/);
assert.match(source, /await queryClient\.cancelQueries\(arrangementQuery\)/);
assert.match(source, /context\?\.mutationId !== latestMutation\.current/);

console.log("widget arrangement mutation validation passed");
