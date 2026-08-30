import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
	new URL("./request-form.tsx", import.meta.url),
	"utf8",
);

assert.equal(
	(source.match(/useRef\(crypto\.randomUUID\(\)\)/g) ?? []).length,
	2,
);
assert.equal(
	(source.match(/idempotencyKey\.current = crypto\.randomUUID\(\)/g) ?? [])
		.length,
	2,
);
assert.equal(
	(source.match(/idempotencyKey: idempotencyKey\.current/g) ?? []).length,
	2,
);
assert.doesNotMatch(source, /idempotencyKey:\s*crypto\.randomUUID\(\)/);

console.log("ticket creation idempotency lifecycle validation passed");
