#!/usr/bin/env node
/**
 * Mirror the oRPC contract and the proto into the repos that consume them.
 *
 * Separate repos mean the contract crosses a boundary, and the choice is between
 * publishing a package and copying the source. Copying is right for now: there
 * is no registry to publish to, the consumers are checked out beside this repo,
 * and a copied file that is regenerated is easier to reason about than a version
 * range that silently drifts.
 *
 * The copies are marked generated and are never edited in place. Run this after
 * changing anything under src/contracts or proto/.
 */

import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(here, "..");
const workspace = resolve(apiRoot, "..");

const BANNER = `// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by \`pnpm contracts:publish\`.
// Change the contract in the api repo and re-run that command.
`;

/** Frontends receive the oRPC contract; both agents receive the proto. */
const CONTRACT_TARGETS = ["portal", "dashboard"].map((n) =>
	join(workspace, n, "src/sdk/contracts"),
);
const PROTO_TARGETS = ["agent", "cli"].map((n) => join(workspace, n, "proto"));

async function mirrorContracts() {
	const source = join(apiRoot, "src/contracts");
	// Contains only zod schemas and @orpc/contract declarations; no server code.

	for (const target of CONTRACT_TARGETS) {
		await rm(target, { recursive: true, force: true });
		await mkdir(target, { recursive: true });
		await cp(source, target, { recursive: true });
		await stampGenerated(target);
		console.log(`contracts -> ${target}`);
	}
}

async function stampGenerated(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			await stampGenerated(path);
			continue;
		}
		if (!entry.name.endsWith(".ts")) continue;
		const body = await readFile(path, "utf8");
		await writeFile(path, BANNER + "\n" + body, "utf8");
	}
}

async function mirrorProto() {
	const source = join(apiRoot, "proto/axioma.proto");
	for (const target of PROTO_TARGETS) {
		await mkdir(target, { recursive: true });
		await cp(source, join(target, "axioma.proto"));
		console.log(`proto -> ${join(target, "axioma.proto")}`);
	}
}

await mirrorContracts();
await mirrorProto();
console.log(
	"\ndone. Consumers must regenerate their bindings if the proto changed.",
);
