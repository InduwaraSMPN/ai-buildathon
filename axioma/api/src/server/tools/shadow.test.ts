import assert from "node:assert/strict";
import test from "node:test";
import {
	assertEnvironmentAllowed,
	executeTool,
	type ResolvedEnvironment,
	sameChangeEnvironment,
	type ToolContext,
	ToolRefusalError,
	tools,
} from "./index";

const connection = (id: string) => ({
	id,
	key: id,
	connectionType: "kubeconfig" as const,
	server: "https://cluster.invalid:6443",
	token: "bearer",
});

const shadowEnv: ResolvedEnvironment = {
	key: "staging",
	mode: "shadow",
	connection: connection("staging"),
};
const actEnv: ResolvedEnvironment = {
	key: "prod",
	mode: "act",
	connection: connection("prod"),
};

const ctx = (
	environment?: ResolvedEnvironment,
	linkedEnvironments?: ReadonlySet<string>,
): ToolContext => ({
	runId: "run-1",
	ticketId: "ticket-1",
	stepId: "step-1",
	dispatchDevice: async () => ({}),
	environment,
	linkedEnvironments,
});

test("shadow-mode environment refuses a write tool before any call", () => {
	assert.throws(
		() =>
			assertEnvironmentAllowed({
				name: "cluster_patch_image",
				effect: "write",
				target: "environment",
				requested: undefined,
				resolved: shadowEnv,
				linked: new Set(["staging", "prod"]),
			}),
		/shadow mode/,
	);
});

test("shadow-mode environment still allows read tools", () => {
	assert.doesNotThrow(() =>
		assertEnvironmentAllowed({
			name: "cluster_read_pods",
			effect: "read",
			target: "environment",
			requested: undefined,
			resolved: shadowEnv,
			linked: new Set(["staging"]),
		}),
	);
	assert.doesNotThrow(() =>
		assertEnvironmentAllowed({
			name: "cluster_read_deployment",
			effect: "read",
			target: "environment",
			requested: undefined,
			resolved: shadowEnv,
			linked: new Set(["staging"]),
		}),
	);
});

test("an environment not linked to the ticket's service is rejected", () => {
	assert.throws(
		() =>
			assertEnvironmentAllowed({
				name: "cluster_read_pods",
				effect: "read",
				target: "environment",
				requested: "prod",
				resolved: shadowEnv,
				linked: new Set(["staging"]),
			}),
		/not linked to the ticket's service/,
	);
});

test("a requested environment that differs from the resolved one is rejected", () => {
	assert.throws(
		() =>
			assertEnvironmentAllowed({
				name: "cluster_read_pods",
				effect: "read",
				target: "environment",
				requested: "prod",
				resolved: shadowEnv,
				linked: new Set(["staging", "prod"]),
			}),
		/refusing to target/,
	);
});

test("a requested environment equal to the resolved one is allowed", () => {
	assert.doesNotThrow(() =>
		assertEnvironmentAllowed({
			name: "cluster_read_pods",
			effect: "read",
			target: "environment",
			requested: "prod",
			resolved: actEnv,
			linked: new Set(["prod", "staging"]),
		}),
	);
	// Omitting the environment is the same as naming the resolved one.
	assert.doesNotThrow(() =>
		assertEnvironmentAllowed({
			name: "cluster_patch_image",
			effect: "write",
			target: "environment",
			requested: undefined,
			resolved: actEnv,
			linked: new Set(["prod"]),
		}),
	);
});

test("executeTool refuses a shadow write without reaching the cluster", async () => {
	await assert.rejects(
		() =>
			executeTool(
				"cluster_patch_image",
				{
					namespace: "ns",
					name: "app",
					container_index: 0,
					image: "repo/app:v2",
				},
				ctx(shadowEnv, new Set(["staging", "prod"])),
			),
		/shadow mode; refusing write tool/,
	);
});

test("shadow suppresses a device proposal, because approving one executes it", () => {
	assert.throws(
		() =>
			assertEnvironmentAllowed({
				name: "device_propose_command",
				effect: "write",
				target: "environment",
				requested: undefined,
				resolved: shadowEnv,
				linked: new Set(["staging"]),
			}),
		/shadow mode/,
	);
});

test("shadow still allows Axioma's own record to be written", () => {
	// Recording an observation is the gate every run must pass before it may
	// resolve. Refusing it in shadow left the agent retrying a call that could
	// never succeed until it hit the consecutive-failure ceiling, so a shadow
	// run could not finish with its diagnosis at all — the one thing shadow
	// mode exists to produce. Nothing here reaches the customer's estate.
	assert.doesNotThrow(() =>
		assertEnvironmentAllowed({
			name: "cmdb_record_observation",
			effect: "write",
			target: "axioma",
			requested: undefined,
			resolved: shadowEnv,
			linked: new Set(["staging"]),
		}),
	);
});

test("only the CMDB observation survives shadow among the registry's writes", () => {
	// Guards the classification itself rather than a hand-written list: a new
	// write tool that reaches the estate must be marked `environment`, or
	// shadow silently stops meaning anything for it.
	const suppressed: string[] = [];
	for (const [name, handler] of Object.entries(tools)) {
		if (handler.effect !== "write") continue;
		try {
			assertEnvironmentAllowed({
				name,
				effect: handler.effect,
				target: handler.target,
				requested: undefined,
				resolved: shadowEnv,
				linked: new Set(["staging"]),
			});
		} catch {
			suppressed.push(name);
		}
	}
	assert.deepEqual(suppressed.sort(), [
		"cluster_patch_image",
		"device_computer_use",
		"device_propose_command",
		"device_run_action",
	]);
});

test("executeTool rejects an environment not linked to the ticket service", async () => {
	await assert.rejects(
		() =>
			executeTool(
				"cluster_read_pods",
				{ namespace: "ns", environment: "prod" },
				ctx(shadowEnv, new Set(["staging"])),
			),
		/not linked to the ticket's service/,
	);
});

test("executeTool rejects a requested environment that differs from the resolved one", async () => {
	await assert.rejects(
		() =>
			executeTool(
				"cluster_read_pods",
				{ namespace: "ns", environment: "prod" },
				ctx(shadowEnv, new Set(["staging", "prod"])),
			),
		/refusing to target/,
	);
});

test("a refusal is thrown as a refusal, not as a platform failure", () => {
	// The gateway records a refusal verbatim on the step that attempted it, and
	// redacts everything else, so the two have to be distinguishable by class
	// rather than by matching on the message.
	assert.throws(
		() =>
			assertEnvironmentAllowed({
				name: "cluster_patch_image",
				effect: "write",
				target: "environment",
				requested: undefined,
				resolved: shadowEnv,
				linked: new Set(["staging"]),
			}),
		ToolRefusalError,
	);
	assert.throws(
		() =>
			assertEnvironmentAllowed({
				name: "cluster_read_pods",
				effect: "read",
				target: "environment",
				requested: "prod",
				resolved: shadowEnv,
				linked: new Set(["staging"]),
			}),
		ToolRefusalError,
	);
});

test("verification completion requires the persisted run environment", () => {
	assert.equal(sameChangeEnvironment("prod", "prod"), true);
	assert.equal(sameChangeEnvironment(undefined, "prod"), false);
	assert.equal(sameChangeEnvironment("prod", "staging"), false);
});
