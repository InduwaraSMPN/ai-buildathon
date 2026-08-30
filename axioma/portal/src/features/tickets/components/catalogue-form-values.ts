export type CatalogueConditionField = {
	key: string;
	condition: unknown;
	isHidden: boolean;
	isReadonly: boolean;
	predefinedValue: unknown | null;
};

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
			left.every((value, index) => equal(value, right[index]))
		);
	return left === right;
}

/** Mirrors the API form-condition evaluator so catalogue visibility cannot diverge. */
export function evaluateCatalogueCondition(
	condition: unknown,
	values: Record<string, unknown>,
): boolean {
	if (condition === null || condition === undefined) return true;
	const node = object(condition, "condition");
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
			? children.every((child) => evaluateCatalogueCondition(child, values))
			: children.some((child) => evaluateCatalogueCondition(child, values));
	}
	if (own(node, "not")) return !evaluateCatalogueCondition(node.not, values);
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

const missing = (value: unknown) =>
	value === undefined ||
	value === null ||
	value === "" ||
	(Array.isArray(value) && value.length === 0);

/** Resolves active fields in API declaration order, pruning values as the API does. */
export function activeCatalogueFieldKeys(
	fields: readonly CatalogueConditionField[],
	supplied: Record<string, unknown>,
): Set<string> {
	const values: Record<string, unknown> = Object.create(null);
	for (const field of fields) {
		if (field.predefinedValue !== null)
			values[field.key] = field.predefinedValue;
		else if (!field.isHidden && !field.isReadonly && own(supplied, field.key))
			values[field.key] = supplied[field.key];
	}

	const activeKeys = new Set<string>();
	for (const field of fields) {
		const active =
			!field.isHidden && evaluateCatalogueCondition(field.condition, values);
		if (!active) {
			if (field.predefinedValue === null) delete values[field.key];
			continue;
		}
		activeKeys.add(field.key);
		if (missing(values[field.key])) delete values[field.key];
	}
	return activeKeys;
}

/** Produces the catalogue API payload without inactive or non-submittable values. */
export function serializeCatalogueValues(
	fields: readonly CatalogueConditionField[],
	supplied: Record<string, unknown>,
): Record<string, unknown> {
	const activeKeys = activeCatalogueFieldKeys(fields, supplied);
	const serialized: Record<string, unknown> = {};
	for (const field of fields) {
		if (
			activeKeys.has(field.key) &&
			!field.isHidden &&
			!field.isReadonly &&
			field.predefinedValue === null &&
			own(supplied, field.key)
		)
			serialized[field.key] = supplied[field.key];
	}
	return serialized;
}
