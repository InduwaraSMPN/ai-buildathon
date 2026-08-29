#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reset = process.argv.includes("--reset");
const run = (...args) => {
	const result = spawnSync("kubectl", args, {
		cwd: root,
		stdio: "inherit",
		shell: true,
	});
	if (result.status) process.exit(result.status);
};

if (reset) run("delete", "namespace", "demo", "--ignore-not-found=true");
run("apply", "-f", "k8s/namespace.yaml");
run("apply", "-f", "k8s/checkout.yaml", "-f", "k8s/reporting.yaml");
console.log(
	"Cluster scenarios seeded. On the demo laptop run scripts/seed-device-fault.ps1; clear_proxy_override repairs it and the proxy facet verifies it.",
);
