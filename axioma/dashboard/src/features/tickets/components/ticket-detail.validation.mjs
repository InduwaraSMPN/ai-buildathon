import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
	new URL("./ticket-detail.tsx", import.meta.url),
	"utf8",
);

assert.match(source, /submittedCustomFields\.current = Object\.fromEntries/);
assert.match(
	source,
	/Object\.is\(customFieldsRef\.current\[key\], submittedValue\)/,
);
assert.doesNotMatch(
	source,
	/editedCustomFields\.current\.clear\(\);\s*await queryClient\.invalidateQueries/,
);

console.log("ticket custom-field reconciliation validation passed");
