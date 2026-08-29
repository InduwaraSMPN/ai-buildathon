import assert from "node:assert/strict";
import test from "node:test";
import type { FormField } from "./forms";
import {
	evaluateFormCondition,
	validateFormFieldValue,
	validateFormSubmission,
} from "./forms";

const field = (
	key: string,
	type: FormField["type"],
	overrides: Partial<FormField> = {},
): FormField => ({
	id: `field-${key}`,
	formId: "form-v2",
	key,
	label: key,
	description: null,
	type,
	ordinal: 0,
	options: null,
	validation: null,
	condition: null,
	isMandatory: false,
	isHidden: false,
	isReadonly: false,
	predefinedValue: null,
	...overrides,
});

test("validates typed values and field constraints", () => {
	assert.equal(
		validateFormFieldValue(
			field("summary", "text", {
				validation: { minLength: 3, maxLength: 8, pattern: "^[A-Z]" },
			}),
			"Network",
		),
		"Network",
	);
	assert.equal(
		validateFormFieldValue(
			field("count", "number", {
				validation: { min: 1, max: 5, integer: true },
			}),
			3,
		),
		3,
	);
	assert.equal(
		validateFormFieldValue(field("enabled", "boolean"), false),
		false,
	);
	assert.equal(
		validateFormFieldValue(field("due", "date"), "2026-02-28"),
		"2026-02-28",
	);
	assert.equal(
		validateFormFieldValue(
			field("region", "select", { options: [{ label: "EU", value: "eu" }] }),
			"eu",
		),
		"eu",
	);
	assert.deepEqual(
		validateFormFieldValue(
			field("roles", "multiselect", {
				options: ["admin", "reader"],
				validation: { maxItems: 2 },
			}),
			["admin", "reader"],
		),
		["admin", "reader"],
	);

	for (const [definition, value] of [
		[field("summary", "text"), 1],
		[field("count", "number"), Number.NaN],
		[field("enabled", "boolean"), "true"],
		[field("due", "date"), "2026-02-30"],
		[field("region", "select", { options: ["eu"] }), "us"],
		[field("roles", "multiselect", { options: ["admin"] }), ["admin", "admin"]],
	] as const)
		assert.throws(
			() => validateFormFieldValue(definition, value),
			/Invalid value/,
		);
});

test("condition AST supports composition and rejects executable or unknown syntax", () => {
	const values = { kind: "incident", urgent: true, tags: ["network"] };
	assert.equal(
		evaluateFormCondition(
			{
				all: [
					{ field: "kind", operator: "equals", value: "incident" },
					{ field: "tags", operator: "contains", value: "network" },
				],
			},
			values,
		),
		true,
	);
	assert.equal(
		evaluateFormCondition({ not: { field: "urgent", value: true } }, values),
		false,
	);
	assert.throws(
		() => evaluateFormCondition({ script: "return true" }, values),
		/exactly one operation/,
	);
	assert.throws(
		() =>
			evaluateFormCondition(
				{ field: "kind", operator: "matches", value: ".*" },
				values,
			),
		/Unsupported condition operator/,
	);
});

test("submission applies conditions, mandatory fields, and trusted predefined values", () => {
	const fields = [
		field("kind", "select", {
			options: ["incident", "request"],
			isMandatory: true,
		}),
		field("details", "textarea", {
			isMandatory: true,
			condition: { field: "kind", value: "incident" },
			validation: { minLength: 3 },
		}),
		field("source", "text", { isReadonly: true, predefinedValue: "portal" }),
		field("internal", "text", { isHidden: true }),
	];
	assert.deepEqual(validateFormSubmission(fields, { kind: "request" }), {
		kind: "request",
		source: "portal",
	});
	assert.deepEqual(
		validateFormSubmission(fields, { kind: "incident", details: "VPN" }),
		{
			kind: "incident",
			details: "VPN",
			source: "portal",
		},
	);
	assert.throws(
		() => validateFormSubmission(fields, { kind: "incident" }),
		/details is mandatory/,
	);
});

test("security boundary rejects unknown, inactive, hidden, readonly, and predefined input", () => {
	const conditional = field("details", "text", {
		condition: { field: "kind", value: "incident" },
	});
	assert.throws(
		() => validateFormSubmission([field("kind", "text")], { admin: true }),
		/Unknown form field/,
	);
	assert.throws(
		() =>
			validateFormSubmission([field("secret", "text", { isHidden: true })], {
				secret: "x",
			}),
		/cannot be submitted/,
	);
	assert.throws(
		() =>
			validateFormSubmission([field("owner", "text", { isReadonly: true })], {
				owner: "attacker",
			}),
		/cannot be submitted/,
	);
	assert.throws(
		() =>
			validateFormSubmission(
				[field("source", "text", { predefinedValue: "portal" })],
				{ source: "api" },
			),
		/cannot be submitted/,
	);
	assert.throws(
		() =>
			validateFormSubmission([field("kind", "text"), conditional], {
				kind: "request",
				details: "x",
			}),
		/Inactive form field/,
	);
	assert.throws(() => validateFormSubmission([], []), /plain object/);
	assert.throws(
		() =>
			validateFormSubmission(
				[],
				Object.assign(Object.create({ admin: true }), {}),
			),
		/plain object/,
	);
});
