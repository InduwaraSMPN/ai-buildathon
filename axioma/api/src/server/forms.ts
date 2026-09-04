import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { createDb } from "@/db";
import { formFields, formSubmissions, forms } from "@/db/schema/forms";

export type FormsDb = ReturnType<typeof createDb>;
export type FormField = typeof formFields.$inferSelect;
export type FormValues = Record<string, unknown>;

type Condition =
	| { field: string; operator?: string; value?: unknown }
	| { all: unknown[] }
	| { any: unknown[] }
	| { not: unknown };

const own = (object: object, key: PropertyKey) => Object.hasOwn(object, key);

function fail(message: string): never {
	throw new TypeError(message);
}

function object(value: unknown, name: string): Record<string, unknown> {
	if (
		value === null ||
		typeof value !== "object" ||
		Array.isArray(value) ||
		(Object.getPrototypeOf(value) !== Object.prototype &&
			Object.getPrototypeOf(value) !== null)
	)
		fail(`${name} must be a plain object`);
	return value as Record<string, unknown>;
}

function equal(left: unknown, right: unknown): boolean {
	if (Array.isArray(left) && Array.isArray(right))
		return (
			left.length === right.length &&
			left.every((value, i) => equal(value, right[i]))
		);
	return left === right;
}

/** Evaluates a deliberately small condition AST; executable expressions are never accepted. */
export function evaluateFormCondition(
	condition: unknown,
	values: FormValues,
): boolean {
	if (condition === null || condition === undefined) return true;
	const node = object(condition, "condition") as Condition &
		Record<string, unknown>;
	const clauses = ["all", "any", "not", "field"].filter((key) =>
		own(node, key),
	);
	if (clauses.length !== 1)
		fail("condition must contain exactly one operation");
	if (own(node, "all") || own(node, "any")) {
		const key = own(node, "all") ? "all" : "any";
		const children = node[key];
		if (!Array.isArray(children) || children.length === 0)
			fail(`condition.${key} must be a non-empty array`);
		return key === "all"
			? children.every((child) => evaluateFormCondition(child, values))
			: children.some((child) => evaluateFormCondition(child, values));
	}
	if (own(node, "not")) return !evaluateFormCondition(node.not, values);
	if (typeof node.field !== "string" || !node.field)
		fail("condition.field is required");
	const actual = own(values, node.field) ? values[node.field] : undefined;
	const operator = node.operator ?? "equals";
	if (typeof operator !== "string") fail("condition.operator must be a string");
	switch (operator) {
		case "equals":
		case "eq":
			return equal(actual, node.value);
		case "notEquals":
		case "neq":
			return !equal(actual, node.value);
		case "exists":
			return actual !== undefined && actual !== null;
		case "notExists":
			return actual === undefined || actual === null;
		case "in":
		case "notIn": {
			if (!Array.isArray(node.value))
				fail(`condition ${operator} value must be an array`);
			const included = node.value.some((candidate) => equal(actual, candidate));
			return operator === "in" ? included : !included;
		}
		case "contains":
			return Array.isArray(actual)
				? actual.some((candidate) => equal(candidate, node.value))
				: typeof actual === "string" &&
						typeof node.value === "string" &&
						actual.includes(node.value);
		default:
			return fail(`Unsupported condition operator ${operator}`);
	}
}

function optionsFor(field: Pick<FormField, "key" | "options">): unknown[] {
	if (!Array.isArray(field.options) || field.options.length === 0)
		fail(`Field ${field.key} must define options`);
	return field.options.map((option) => {
		if (
			typeof option === "string" ||
			typeof option === "number" ||
			typeof option === "boolean"
		)
			return option;
		const entry = object(option, `Option for ${field.key}`);
		if (!own(entry, "value"))
			fail(`Option for ${field.key} must contain value`);
		return entry.value;
	});
}

/**
 * A field pattern is admin-authored but runs against portal-supplied text, so
 * both ends are bounded: backtracking cost grows with the subject, and a
 * pathological pattern needs length to be pathological. The catalogue contract
 * bounds the pattern too; this is the write boundary every other caller —
 * inbound mail, the API — reaches instead.
 */
const MAX_PATTERN_LENGTH = 200;
const MAX_PATTERN_SUBJECT_LENGTH = 4_096;
const MAX_COMPILED_PATTERNS = 500;

const compiledPatterns = new Map<string, RegExp>();

/** Compiles each distinct pattern once; a submission is many values over few patterns. */
function compilePattern(source: string, key: string): RegExp {
	const cached = compiledPatterns.get(source);
	if (cached) return cached;
	if (source.length > MAX_PATTERN_LENGTH)
		fail(`pattern for ${key} must be at most ${MAX_PATTERN_LENGTH} characters`);
	let pattern: RegExp;
	try {
		pattern = new RegExp(source);
	} catch {
		return fail(`pattern for ${key} is invalid`);
	}
	if (compiledPatterns.size >= MAX_COMPILED_PATTERNS) compiledPatterns.clear();
	compiledPatterns.set(source, pattern);
	return pattern;
}

function validDate(value: string) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return false;
	const date = new Date(
		Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
	);
	return date.toISOString().slice(0, 10) === value;
}

/** Validates one supplied or predefined value, including the field's JSON constraints. */
export function validateFormFieldValue(
	field: Pick<FormField, "key" | "type" | "options" | "validation">,
	value: unknown,
): unknown {
	const invalid = () => fail(`Invalid value for form field ${field.key}`);
	switch (field.type) {
		case "text":
		case "textarea":
			if (typeof value !== "string") return invalid();
			break;
		case "number":
			if (typeof value !== "number" || !Number.isFinite(value))
				return invalid();
			break;
		case "boolean":
			if (typeof value !== "boolean") return invalid();
			break;
		case "date":
			if (typeof value !== "string" || !validDate(value)) return invalid();
			break;
		case "select":
			if (!optionsFor(field).some((option) => equal(option, value)))
				return invalid();
			break;
		case "multiselect": {
			const options = optionsFor(field);
			if (
				!Array.isArray(value) ||
				value.some((item) => !options.some((option) => equal(option, item))) ||
				value.some((item, index) =>
					value.slice(0, index).some((prior) => equal(prior, item)),
				)
			)
				return invalid();
			break;
		}
	}

	if (field.validation === null || field.validation === undefined) return value;
	const constraints = object(field.validation, `Validation for ${field.key}`);
	const allowed =
		field.type === "text" || field.type === "textarea"
			? ["minLength", "maxLength", "pattern"]
			: field.type === "number"
				? ["min", "max", "integer"]
				: field.type === "date"
					? ["min", "max"]
					: field.type === "multiselect"
						? ["minItems", "maxItems"]
						: [];
	for (const key of Object.keys(constraints))
		if (!allowed.includes(key))
			fail(`Unsupported ${field.type} constraint ${key}`);

	const integerConstraint = (key: string) => {
		const constraint = constraints[key];
		if (
			constraint !== undefined &&
			(!Number.isSafeInteger(constraint) || (constraint as number) < 0)
		)
			fail(`${key} for ${field.key} must be a non-negative integer`);
		return constraint as number | undefined;
	};
	if (
		typeof value === "string" &&
		(field.type === "text" || field.type === "textarea")
	) {
		const min = integerConstraint("minLength");
		const max = integerConstraint("maxLength");
		if (min !== undefined && max !== undefined && min > max)
			fail(`Invalid length constraints for ${field.key}`);
		if (min !== undefined && value.length < min) return invalid();
		if (max !== undefined && value.length > max) return invalid();
		if (constraints.pattern !== undefined) {
			if (typeof constraints.pattern !== "string")
				fail(`pattern for ${field.key} must be a string`);
			// Reject an oversized subject before the regex sees it: maxLength only
			// bounds the value when the field's author set one.
			if (value.length > MAX_PATTERN_SUBJECT_LENGTH) return invalid();
			if (!compilePattern(constraints.pattern, field.key).test(value))
				return invalid();
		}
	}
	if (field.type === "number") {
		const min = constraints.min;
		const max = constraints.max;
		if (min !== undefined && (typeof min !== "number" || !Number.isFinite(min)))
			fail(`min for ${field.key} must be a finite number`);
		if (max !== undefined && (typeof max !== "number" || !Number.isFinite(max)))
			fail(`max for ${field.key} must be a finite number`);
		if (typeof min === "number" && typeof max === "number" && min > max)
			fail(`Invalid numeric constraints for ${field.key}`);
		if (typeof min === "number" && (value as number) < min) return invalid();
		if (typeof max === "number" && (value as number) > max) return invalid();
		if (
			constraints.integer !== undefined &&
			typeof constraints.integer !== "boolean"
		)
			fail(`integer for ${field.key} must be boolean`);
		if (constraints.integer === true && !Number.isSafeInteger(value))
			return invalid();
	}
	if (field.type === "date") {
		const min = constraints.min;
		const max = constraints.max;
		if (min !== undefined && (typeof min !== "string" || !validDate(min)))
			fail(`min for ${field.key} must be a valid date`);
		if (max !== undefined && (typeof max !== "string" || !validDate(max)))
			fail(`max for ${field.key} must be a valid date`);
		if (typeof min === "string" && (value as string) < min) return invalid();
		if (typeof max === "string" && (value as string) > max) return invalid();
	}
	if (field.type === "multiselect") {
		const min = integerConstraint("minItems");
		const max = integerConstraint("maxItems");
		if (min !== undefined && max !== undefined && min > max)
			fail(`Invalid item constraints for ${field.key}`);
		if (min !== undefined && (value as unknown[]).length < min)
			return invalid();
		if (max !== undefined && (value as unknown[]).length > max)
			return invalid();
	}
	return value;
}

const missing = (value: unknown) =>
	value === undefined ||
	value === null ||
	value === "" ||
	(Array.isArray(value) && value.length === 0);

/** Validates an untrusted submission and returns only canonical, persistable field values. */
export function validateFormSubmission(
	fields: readonly FormField[],
	input: unknown,
): FormValues {
	const supplied = object(input, "Form submission");
	const byKey = new Map<string, FormField>();
	for (const field of fields) {
		if (!field.key || byKey.has(field.key))
			fail(`Duplicate or empty form field key ${field.key}`);
		byKey.set(field.key, field);
	}
	for (const key of Object.keys(supplied))
		if (!byKey.has(key)) fail(`Unknown form field ${key}`);

	const values: FormValues = Object.create(null) as FormValues;
	for (const field of fields) {
		const wasSupplied = own(supplied, field.key);
		if (
			wasSupplied &&
			(field.isHidden || field.isReadonly || field.predefinedValue !== null)
		)
			fail(`Form field ${field.key} cannot be submitted`);
		if (field.predefinedValue !== null)
			values[field.key] = validateFormFieldValue(field, field.predefinedValue);
		else if (wasSupplied) values[field.key] = supplied[field.key];
	}

	for (const field of fields) {
		const active =
			!field.isHidden && evaluateFormCondition(field.condition, values);
		const wasSupplied = own(supplied, field.key);
		if (!active) {
			if (wasSupplied)
				fail(`Inactive form field ${field.key} cannot be submitted`);
			if (field.predefinedValue === null) delete values[field.key];
			continue;
		}
		const value = values[field.key];
		if (field.isMandatory && missing(value))
			fail(`Form field ${field.key} is mandatory`);
		if (!missing(value))
			values[field.key] = validateFormFieldValue(field, value);
		else delete values[field.key];
	}
	return { ...values };
}

export type SubmitVersionedFormInput = {
	formKey: string;
	version: number;
	values: unknown;
	submitterId?: string | null;
	ticketId?: string | null;
};

/** Loads the exact published version, validates at the write boundary, then persists it. */
export async function submitVersionedForm(
	db: FormsDb,
	input: SubmitVersionedFormInput,
) {
	if (!input.formKey.trim()) fail("formKey is required");
	if (!Number.isSafeInteger(input.version) || input.version <= 0)
		fail("version must be a positive integer");
	return db.transaction(async (tx) => {
		const form = (
			await tx
				.select({ id: forms.id })
				.from(forms)
				.where(
					and(
						eq(forms.key, input.formKey),
						eq(forms.version, input.version),
						eq(forms.status, "published"),
					),
				)
				.limit(1)
		)[0];
		if (!form)
			throw new RangeError(
				`Published form ${input.formKey} version ${input.version} was not found`,
			);
		const fields = await tx
			.select()
			.from(formFields)
			.where(eq(formFields.formId, form.id))
			.orderBy(asc(formFields.ordinal));
		const values = validateFormSubmission(fields, input.values);
		const [submission] = await tx
			.insert(formSubmissions)
			.values({
				id: randomUUID(),
				formId: form.id,
				submitterId: input.submitterId ?? null,
				ticketId: input.ticketId ?? null,
				values,
			})
			.returning();
		return submission;
	});
}
