import assert from "node:assert/strict";
import test from "node:test";
import { validateAttributes } from "./cmdb";

const properties = [
	{
		id: "name",
		propertyKey: "hostname",
		propertyType: "string",
		isRequired: true,
	},
	{
		id: "cores",
		propertyKey: "cores",
		propertyType: "integer",
		isRequired: false,
	},
];

test("attribute validation returns structured unknown and typed errors", () => {
	assert.deepEqual(
		validateAttributes("Server", { surprise: true }, properties),
		[
			{
				code: "unknown_property",
				message: 'Class "Server" does not declare property "surprise"',
				classKey: "Server",
				propertyKey: "surprise",
			},
			{
				code: "missing_property",
				message: 'Class "Server" requires property "hostname"',
				classKey: "Server",
				propertyKey: "hostname",
			},
		],
	);
	assert.deepEqual(
		validateAttributes("Server", { hostname: "db", cores: "8" }, properties),
		[
			{
				code: "invalid_property_type",
				message: 'Property "cores" on class "Server" must be integer',
				classKey: "Server",
				propertyKey: "cores",
				expectedType: "integer",
			},
		],
	);
});
