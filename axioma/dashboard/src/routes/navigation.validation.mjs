import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const authDir = fileURLToPath(new URL("./_auth/", import.meta.url));

const navigationSource = readFileSync(
	new URL("../lib/navigation.ts", import.meta.url),
	"utf8",
);

// Derive the registry without importing it (the validation must run before
// `pnpm build` has regenerated the route tree).
const pathPattern = /to:\s*"(\/[\w/-]+)"/g;
const registryPaths = [...navigationSource.matchAll(pathPattern)].map(
	(match) => match[1],
);

// A path has a guard when its registry entry carries a `capabilities` field.
// Match the entry block starting at `to: "<path>"` up to the next entry
// separator. The separator is `},` followed by a newline and `{`, which covers
// both the single-line `{ to: "/x", ... },` and the multi-line form. Using
// `\n\s*\},\n\s*\{` would miss the single-line case where `}` sits on the same
// line as `to:` and only `},` is before the newline. The `\r?` handles both
// LF and CRLF line endings so the validation passes on Windows and Linux.
const entryBlock = (to) => {
	const start = navigationSource.indexOf(`to: "${to}"`);
	const rest = navigationSource.slice(start);
	const end = rest.search(/\},\r?\n\s*\{|as const/s);
	const block = end === -1 ? rest : rest.slice(0, end);
	return block;
};
const isGuarded = (to) => /capabilities:\s*\[/.test(entryBlock(to));

// `LANDING` is the loop invariant: it must carry no gate, or users missing it
// would bounce to it forever.
assert.equal(
	isGuarded("/overview"),
	false,
	"LANDING (/overview) must not require a capability",
);
assert.ok(
	/LANDING\s*=\s*"\/overview"/.test(navigationSource),
	"LANDING must be /overview",
);

const routeFiles = readdirSync(authDir).filter(
	(file) => file.endsWith(".tsx") && file !== "route.tsx",
);

// path -> file, derived from each file's createFileRoute id.
const routePaths = new Map();
for (const file of routeFiles) {
	const source = readFileSync(`${authDir}${file}`, "utf8");
	const match = source.match(/createFileRoute\("([^"]+)"\)/);
	assert.ok(match, `route file has no createFileRoute id: ${file}`);
	const path = match[1].replace(/^\/_auth/, "").replace(/\/$/, "");
	// Parameterised routes are per-record, not nav targets.
	if (path.includes("$")) continue;
	routePaths.set(path, file);
}

// 1. Every registry `to` corresponds to a real route path (skip the splat and
//    the parameterised admin base, which resolves via its index sibling).
for (const to of registryPaths) {
	if (to === "/_auth") continue;
	assert.ok(
		routePaths.has(to),
		`registry path ${to} has no matching route file`,
	);
}

// 2. Every guarded route names `requireNav("<path>"` in its source.
for (const [path, file] of routePaths) {
	if (!isGuarded(path)) continue;
	const source = readFileSync(`${authDir}${file}`, "utf8");
	assert.match(
		source,
		new RegExp(`requireNav\\("${escapeRegExp(path)}"`),
		`guarded route ${path} (${file}) is missing requireNav("${path}")`,
	);
}

// 3. Every route that calls `requireNav(` names a path present in the registry.
for (const [path, file] of routePaths) {
	const source = readFileSync(`${authDir}${file}`, "utf8");
	if (!source.includes("requireNav(")) continue;
	assert.ok(
		registryPaths.includes(path),
		`route ${file} guards ${path}, which is not a registry entry`,
	);
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

console.log(
	`navigation drift validation passed (${registryPaths.length} registry paths, ${routePaths.size} route files)`,
);
