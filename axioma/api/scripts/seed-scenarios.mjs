#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reset = process.argv.includes("--reset");

// `--reset` deletes a namespace, which nothing undoes, and kubectl takes its
// target from whatever context the workstation happens to be pointed at — as
// likely a shared cluster as a local one. So the target is decided here and
// passed to every call, rather than left ambient: a context on the allowlist,
// or one the operator named outright with --context.
const ALLOWED_PREFIXES = (process.env.AXIOMA_SEED_CONTEXTS ?? "kind-")
	.split(",")
	.map((prefix) => prefix.trim())
	.filter(Boolean);

const fail = (message) => {
	console.error(message);
	process.exit(1);
};

const readContextArgument = () => {
	const index = process.argv.indexOf("--context");
	if (index !== -1) return process.argv[index + 1];
	const inline = process.argv.find((arg) => arg.startsWith("--context="));
	return inline?.slice("--context=".length);
};

const kubectl = (args, { capture = false } = {}) => {
	const result = spawnSync("kubectl", args, {
		cwd: root,
		stdio: capture ? "pipe" : "inherit",
		encoding: "utf8",
		shell: true,
	});
	// A null status means kubectl was killed or never spawned at all. Reading
	// that as success is what printed "Cluster scenarios seeded." over a cluster
	// nothing had been applied to.
	if (result.error) throw result.error;
	if (result.status !== 0) {
		const how =
			result.status === null
				? `was killed by ${result.signal ?? "an unknown signal"}`
				: `exited ${result.status}`;
		fail(`kubectl ${args.join(" ")} ${how}.`);
	}
	return result.stdout ?? "";
};

const named = readContextArgument();
if (named !== undefined && !named) {
	fail("--context needs a context name.");
}
const context =
	named ?? kubectl(["config", "current-context"], { capture: true }).trim();
if (!context) {
	fail(
		"kubectl has no current context. Point it at a cluster, or pass --context NAME.",
	);
}
// The context reaches a shell, so it has to look like a context name.
if (!/^[A-Za-z0-9._@:/-]+$/.test(context)) {
	fail(`Refusing to use the context ${JSON.stringify(context)}: odd name.`);
}
if (!named && !ALLOWED_PREFIXES.some((prefix) => context.startsWith(prefix))) {
	fail(
		`Refusing to seed ${context}: it is not one of ${ALLOWED_PREFIXES.join(", ")}*.\n` +
			"This applies and, with --reset, deletes the demo namespace in whatever\n" +
			"cluster kubectl is pointed at. Switch to a local cluster, pass\n" +
			"--context NAME for the one you mean, or widen AXIOMA_SEED_CONTEXTS.",
	);
}

const run = (...args) => kubectl(["--context", context, ...args]);

if (reset) run("delete", "namespace", "demo", "--ignore-not-found=true");
run("apply", "-f", "k8s/namespace.yaml");
run("apply", "-f", "k8s/checkout.yaml", "-f", "k8s/reporting.yaml");
console.log(
	`Cluster scenarios seeded into ${context}. On the demo laptop run scripts/seed-device-fault.ps1; clear_proxy_override repairs it and the proxy facet verifies it.`,
);
