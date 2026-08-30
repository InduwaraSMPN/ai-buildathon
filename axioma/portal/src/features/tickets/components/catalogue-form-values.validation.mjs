import assert from "node:assert/strict";
import test from "node:test";
import {
	activeCatalogueFieldKeys,
	evaluateCatalogueCondition,
	serializeCatalogueValues,
} from "./catalogue-form-values.ts";

test("evaluates every catalogue condition operator with API semantics", () => {
	const values = {
		answer: "yes",
		count: 2,
		tags: ["vpn", "urgent"],
		sequence: ["a", "b"],
		nullValue: null,
	};

	assert.equal(evaluateCatalogueCondition(null, values), true);
	assert.equal(
		evaluateCatalogueCondition({ field: "answer", value: "yes" }, values),
		true,
	);
	assert.equal(
		evaluateCatalogueCondition(
			{ field: "answer", operator: "equals", value: "yes" },
			values,
		),
		true,
	);
	assert.equal(
		evaluateCatalogueCondition(
			{ field: "count", operator: "eq", value: 2 },
			values,
		),
		true,
	);
	assert.equal(
		evaluateCatalogueCondition(
			{ field: "answer", operator: "notEquals", value: "no" },
			values,
		),
		true,
	);
	assert.equal(
		evaluateCatalogueCondition(
			{ field: "answer", operator: "neq", value: "no" },
			values,
		),
		true,
	);
	assert.equal(
		evaluateCatalogueCondition({ field: "answer", operator: "exists" }, values),
		true,
	);
	assert.equal(
		evaluateCatalogueCondition(
			{ field: "nullValue", operator: "exists" },
			values,
		),
		false,
	);
	assert.equal(
		evaluateCatalogueCondition(
			{ field: "missing", operator: "notExists" },
			values,
		),
		true,
	);
	assert.equal(
		evaluateCatalogueCondition(
			{ field: "count", operator: "in", value: [1, 2, 3] },
			values,
		),
		true,
	);
	assert.equal(
		evaluateCatalogueCondition(
			{ field: "sequence", operator: "in", value: [["a", "b"]] },
			values,
		),
		true,
	);
	assert.equal(
		evaluateCatalogueCondition(
			{ field: "count", operator: "notIn", value: [3, 4] },
			values,
		),
		true,
	);
	assert.equal(
		evaluateCatalogueCondition(
			{ field: "tags", operator: "contains", value: "vpn" },
			values,
		),
		true,
	);
	assert.equal(
		evaluateCatalogueCondition(
			{ field: "answer", operator: "contains", value: "es" },
			values,
		),
		true,
	);
	assert.equal(
		evaluateCatalogueCondition(
			{
				all: [
					{ field: "answer", value: "yes" },
					{
						any: [
							{ field: "count", value: 1 },
							{ field: "count", value: 2 },
						],
					},
					{ not: { field: "missing", operator: "exists" } },
				],
			},
			values,
		),
		true,
	);
});

test("rejects invalid condition shapes like the API evaluator", () => {
	assert.throws(
		() =>
			evaluateCatalogueCondition(
				{ field: "answer", operator: "in", value: "yes" },
				{},
			),
		/condition in value must be an array/,
	);
	assert.throws(
		() =>
			evaluateCatalogueCondition({ field: "answer", operator: "matches" }, {}),
		/Unsupported condition operator matches/,
	);
});

test("omits inactive stale values and chains conditions through active values", () => {
	const fields = [
		field("controller"),
		field("gate", { field: "controller", value: true }),
		field("dependent", { field: "gate", value: "open" }),
		field("independent", { field: "controller", value: false }),
	];
	const supplied = {
		controller: false,
		gate: "open",
		dependent: "stale",
		independent: "keep",
	};

	assert.deepEqual(
		[...activeCatalogueFieldKeys(fields, supplied)],
		["controller", "independent"],
	);
	assert.deepEqual(serializeCatalogueValues(fields, supplied), {
		controller: false,
		independent: "keep",
	});
});

test("uses predefined values for conditions without submitting them", () => {
	const fields = [
		field("region", null, { isHidden: true, predefinedValue: "emea" }),
		field("details", { field: "region", operator: "eq", value: "emea" }),
		field("readonly", null, { isReadonly: true }),
	];
	const supplied = {
		region: "tampered",
		details: "keep",
		readonly: "tampered",
	};

	assert.deepEqual(serializeCatalogueValues(fields, supplied), {
		details: "keep",
	});
});

function field(key, condition = null, overrides = {}) {
	return {
		key,
		condition,
		isHidden: false,
		isReadonly: false,
		predefinedValue: null,
		...overrides,
	};
}
