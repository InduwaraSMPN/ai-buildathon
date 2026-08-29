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

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

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
const check = process.argv.includes("--check");

async function writeOrCheck(path, expected) {
	if (check) {
		const actual = await readFile(path).catch(() => null);
		if (!actual || !isDeepStrictEqual(actual, Buffer.from(expected))) {
			throw new Error(`stale generated file: ${path}`);
		}
		return;
	}
	await writeFile(path, expected);
}

async function files(dir, prefix = "") {
	const result = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const relative = join(prefix, entry.name);
		if (entry.isDirectory())
			result.push(...(await files(join(dir, entry.name), relative)));
		else result.push(relative);
	}
	return result.sort();
}

async function mirrorContracts() {
	const source = join(apiRoot, "src/contracts");
	const sourceFiles = await files(source);
	// Contains only zod schemas and @orpc/contract declarations; no server code.
	for (const target of CONTRACT_TARGETS) {
		if (check) {
			const targetFiles = await files(target).catch(() => []);
			if (!isDeepStrictEqual(sourceFiles, targetFiles))
				throw new Error(`stale generated tree: ${target}`);
		} else {
			await rm(target, { recursive: true, force: true });
		}
		for (const relative of sourceFiles) {
			const output = join(target, relative);
			await mkdir(dirname(output), { recursive: true });
			const body = await readFile(join(source, relative));
			await writeOrCheck(
				output,
				relative.endsWith(".ts") ? `${BANNER}\n${body.toString("utf8")}` : body,
			);
		}
		console.log(`contracts ${check ? "verified" : "->"} ${target}`);
	}
}

async function mirrorProto() {
	const source = await readFile(join(apiRoot, "proto/axioma.proto"));
	for (const target of PROTO_TARGETS) {
		await mkdir(target, { recursive: true });
		const output = join(target, "axioma.proto");
		await writeOrCheck(output, source);
		console.log(`proto ${check ? "verified" : "->"} ${output}`);
	}
}

await mirrorContracts();
await mirrorProto();
console.log(
	check
		? "\ncontracts and proto copies are fresh."
		: "\ndone. Consumers must regenerate their bindings if the proto changed.",
);
