import assert from "node:assert/strict";
import test from "node:test";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { appRouter } from "./routers";

const components = {
	securitySchemes: {
		bearerAuth: {
			type: "http" as const,
			scheme: "bearer",
			bearerFormat: "API key",
		},
	},
};

test("OpenAPI documents bearer auth and required capabilities", async () => {
	const spec = await new OpenAPIGenerator({
		schemaConverters: [new ZodToJsonSchemaConverter()],
	}).generate(appRouter, { components });
	assert.deepEqual(
		spec.components?.securitySchemes,
		components.securitySchemes,
	);
	const paths = spec.paths as Record<
		string,
		Record<string, Record<string, unknown>>
	>;
	const operations = Object.values(paths).flatMap((path) =>
		Object.values(path).filter((value) => "operationId" in value),
	);
	const createTicket = operations.find(
		(operation) => operation.operationId === "createTicket",
	);
	assert.deepEqual(createTicket?.security, [{ bearerAuth: [] }]);
	assert.deepEqual(createTicket?.["x-required-capabilities"], [
		"ticket.create",
	]);
	assert.equal(createTicket?.["x-capability-mode"], "all");
	const listTickets = operations.find(
		(operation) => operation.operationId === "listTickets",
	);
	assert.equal(listTickets?.["x-capability-mode"], "any");
	const health = operations.find(
		(operation) => operation.operationId === "healthCheck",
	);
	assert.equal(health?.security, undefined);
});
