import assert from "node:assert/strict";
import test from "node:test";
import type {
	DynamicFieldConfig,
	DynamicFieldType,
} from "@/db/schema/dynamic-fields";
import {
	reactivateFieldDefinition,
	readDynamicFieldValues,
	retireFieldDefinition,
	validateFieldConfig,
	validateFieldValue,
} from ".";

const field = (
	fieldType: DynamicFieldType,
	config: DynamicFieldConfig = {},
) => ({
	key: fieldType,
	fieldType,
	config,
});

test("accepts valid values for every dynamic field type", () => {
	const cases: [DynamicFieldType, DynamicFieldConfig, unknown][] = [
		["text", { maxLength: 5 }, "hello"],
		["textarea", { maxLength: 20 }, "hello\nworld"],
		["integer", { min: -2, max: 2 }, 0],
		["date", {}, "2024-02-29"],
		["datetime", {}, "2024-02-29T12:30:45.123Z"],
		["dropdown", { options: ["one", "two"] }, "two"],
		["multiselect", { options: ["one", "two"] }, ["two", "one"]],
		["checkbox", {}, false],
		["reference", { referenceType: "ticket" }, "TKT-123"],
	];
	for (const [type, config, value] of cases)
		assert.deepEqual(validateFieldValue(field(type, config), value), value);
});

test("rejects invalid scalar and temporal values", () => {
	const cases: [DynamicFieldType, DynamicFieldConfig, unknown][] = [
		["text", { maxLength: 2 }, "long"],
		["textarea", {}, 1],
		["integer", {}, 1.5],
		["integer", { min: 2 }, 1],
		["integer", { max: 2 }, 3],
		["date", {}, "2023-02-29"],
		["date", {}, "2024-2-09"],
		["datetime", {}, "2024-01-01T12:00"],
		["datetime", {}, "not-a-date"],
		["checkbox", {}, 1],
		["reference", { referenceType: "ticket" }, "  "],
	];
	for (const [type, config, value] of cases)
		assert.throws(
			() => validateFieldValue(field(type, config), value),
			(error) =>
				error instanceof TypeError &&
				error.message.includes(`dynamic field ${type}`),
		);
});

test("enforces configured choices and rejects duplicate multiselect values", () => {
	const dropdown = field("dropdown", { options: ["one", "two"] });
	const multiselect = field("multiselect", { options: ["one", "two"] });
	assert.throws(() => validateFieldValue(dropdown, "three"), TypeError);
	assert.throws(
		() => validateFieldValue(multiselect, ["one", "three"]),
		TypeError,
	);
	assert.throws(
		() => validateFieldValue(multiselect, ["one", "one"]),
		TypeError,
	);
	assert.throws(() => validateFieldValue(multiselect, "one"), TypeError);
});

test("retired values survive and become readable after reactivation", async () => {
	let active = true;
	const values = [{ key: "site", value: "Colombo" }];
	const db = {
		update: () => ({
			set: ({ isActive }: { isActive: boolean }) => {
				active = isActive;
				return {
					where: () => ({
						returning: async () => [{ id: "field-1", isActive }],
					}),
				};
			},
		}),
		select: () => ({
			from: () => ({
				innerJoin: () => ({ where: async () => (active ? values : []) }),
			}),
		}),
	} as never;

	await retireFieldDefinition(db, "field-1");
	assert.deepEqual(await readDynamicFieldValues(db, "ticket", "ticket-1"), {});
	assert.deepEqual(values, [{ key: "site", value: "Colombo" }]);
	await reactivateFieldDefinition(db, "field-1");
	assert.deepEqual(await readDynamicFieldValues(db, "ticket", "ticket-1"), {
		site: "Colombo",
	});
});

test("validates type-specific field configuration", () => {
	assert.deepEqual(validateFieldConfig("integer", { min: 0, max: 10 }), {
		min: 0,
		max: 10,
	});
	assert.throws(
		() => validateFieldConfig("integer", { min: 2, max: 1 }),
		TypeError,
	);
	assert.throws(() => validateFieldConfig("text", { maxLength: 0 }), TypeError);
	assert.throws(() => validateFieldConfig("dropdown"), TypeError);
	assert.throws(
		() => validateFieldConfig("dropdown", { options: ["same", "same"] }),
		TypeError,
	);
	assert.throws(
		() => validateFieldConfig("multiselect", { options: [] }),
		TypeError,
	);
	assert.throws(() => validateFieldConfig("reference"), TypeError);
	assert.throws(
		() => validateFieldConfig("checkbox", { maxLength: 1 }),
		/error.*checkbox|not valid for checkbox/,
	);
});
