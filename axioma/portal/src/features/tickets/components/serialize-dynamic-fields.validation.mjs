import assert from "node:assert/strict";
import test from "node:test";
import { serializeDynamicFields } from "./serialize-dynamic-fields.ts";

test("serializes portal incident dynamic fields", () => {
	const definitions = [
		{ key: "location", fieldType: "text" },
		{ key: "attempts", fieldType: "integer" },
		{ key: "outage", fieldType: "checkbox" },
		{ key: "startedAt", fieldType: "datetime" },
		{ key: "affectedSystems", fieldType: "multiselect" },
		{ key: "optional", fieldType: "text" },
	];
	const values = {
		title: "VPN unavailable",
		body: "The fixed incident fields are submitted separately.",
		location: "HQ",
		attempts: 0,
		outage: false,
		startedAt: "2026-08-30T09:15:00+05:30",
		affectedSystems: ["mail", "vpn"],
		optional: "",
	};

	const serialized = serializeDynamicFields(definitions, values);

	assert.deepEqual(serialized, {
		location: "HQ",
		attempts: 0,
		outage: false,
		startedAt: "2026-08-30T03:45:00.000Z",
		affectedSystems: ["mail", "vpn"],
	});
	assert.equal("title" in serialized, false);
	assert.equal("body" in serialized, false);
});
