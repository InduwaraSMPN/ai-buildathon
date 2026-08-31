import assert from "node:assert/strict";
import test from "node:test";
import {
	assertEnvironmentAllowed,
	executeTool,
	type ResolvedEnvironment,
	sameChangeEnvironment,
	type ToolContext,
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
			requested: undefined,
			resolved: shadowEnv,
			linked: new Set(["staging"]),
		}),
	);
	assert.doesNotThrow(() =>
		assertEnvironmentAllowed({
			name: "cluster_read_deployment",
			effect: "read",
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

test("verification completion requires the persisted run environment", () => {
	assert.equal(sameChangeEnvironment("prod", "prod"), true);
	assert.equal(sameChangeEnvironment(undefined, "prod"), false);
	assert.equal(sameChangeEnvironment("prod", "staging"), false);
});
