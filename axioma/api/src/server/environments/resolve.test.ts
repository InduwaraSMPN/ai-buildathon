import assert from "node:assert/strict";
import test from "node:test";
import { resolveEnvironment } from "./resolve";

test("ticket precedence beats both CMDB and default", () => {
	const result = resolveEnvironment({
		ticket: { serviceId: "svc-app", environmentId: "env-staging" },
		serviceEnvironmentIds: ["env-staging", "env-prod"],
		cmdbEnvironmentId: "env-prod",
		defaultEnvironmentId: "env-default",
	});
	assert.deepEqual(result, { environmentId: "env-staging", source: "ticket" });
});

test("CMDB beats default when the ticket has no linkage", () => {
	const result = resolveEnvironment({
		ticket: { serviceId: "svc-app", environmentId: null },
		serviceEnvironmentIds: ["env-prod"],
		cmdbEnvironmentId: "env-prod",
		defaultEnvironmentId: "env-default",
	});
	assert.deepEqual(result, { environmentId: "env-prod", source: "cmdb" });
});

test("default is used when nothing more specific resolves", () => {
	const result = resolveEnvironment({
		ticket: { serviceId: "svc-app", environmentId: null },
		serviceEnvironmentIds: [],
		cmdbEnvironmentId: null,
		defaultEnvironmentId: "env-default",
	});
	assert.deepEqual(result, { environmentId: "env-default", source: "default" });
});

test("a ticket naming an environment not linked to its service is rejected", () => {
	assert.throws(
		() =>
			resolveEnvironment({
				ticket: { serviceId: "svc-app", environmentId: "env-prod" },
				serviceEnvironmentIds: ["env-staging"],
				defaultEnvironmentId: "env-default",
			}),
		/not linked to service/,
	);
});

test("throws when no environment can be resolved", () => {
	assert.throws(
		() =>
			resolveEnvironment({
				ticket: { serviceId: "svc-app", environmentId: null },
				serviceEnvironmentIds: [],
				cmdbEnvironmentId: null,
				defaultEnvironmentId: null,
			}),
		/no environment could be resolved/,
	);
});

test("accepts a Set of service environment ids as well as an array", () => {
	const result = resolveEnvironment({
		ticket: { serviceId: "svc-app", environmentId: "env-staging" },
		serviceEnvironmentIds: new Set(["env-staging"]),
		defaultEnvironmentId: "env-default",
	});
	assert.deepEqual(result, { environmentId: "env-staging", source: "ticket" });
});
