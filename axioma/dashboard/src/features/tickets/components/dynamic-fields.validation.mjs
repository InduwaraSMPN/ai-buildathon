import assert from "node:assert/strict";
import { serializeDynamicFields } from "./serialize-dynamic-fields.ts";

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

const expected = {
	location: "HQ",
	attempts: 0,
	outage: false,
	startedAt: "2026-08-30T03:45:00.000Z",
	affectedSystems: ["mail", "vpn"],
	optional: null,
};
const serialized = serializeDynamicFields(definitions, values);

assert.deepEqual(serialized, expected);
assert.equal("title" in serialized, false);
assert.equal("body" in serialized, false);

console.log("dashboard dynamic field serialization validation passed");
