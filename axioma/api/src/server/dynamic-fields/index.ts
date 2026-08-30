import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { createDb } from "@/db";
import {
	type DynamicFieldConfig,
	type DynamicFieldType,
	dynamicFields,
	dynamicFieldValues,
} from "@/db/schema/dynamic-fields";

type Database = ReturnType<typeof createDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DynamicFieldsDb = Database | Transaction;
export type FieldDefinition = typeof dynamicFields.$inferSelect;
export type NewFieldDefinition = Pick<
	typeof dynamicFields.$inferInsert,
	"key" | "label" | "fieldType" | "objectType"
> &
	Partial<
		Pick<
			typeof dynamicFields.$inferInsert,
			"config" | "displayOrder" | "isActive"
		>
	>;

const keyPattern = /^[a-z][a-z0-9_]{0,63}$/;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const dateTimePattern =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function fail(message: string): never {
	throw new TypeError(message);
}

function assertNonBlank(value: string, name: string) {
	if (!value.trim()) fail(`${name} must not be blank`);
}

function assertPositiveInteger(value: unknown, name: string) {
	if (!Number.isSafeInteger(value) || (value as number) <= 0)
		fail(`${name} must be a positive integer`);
}

export function validateFieldConfig(
	fieldType: DynamicFieldType,
	config: DynamicFieldConfig = {},
): DynamicFieldConfig {
	const allowed =
		fieldType === "text" || fieldType === "textarea"
			? ["maxLength"]
			: fieldType === "integer"
				? ["min", "max"]
				: fieldType === "dropdown" || fieldType === "multiselect"
					? ["options"]
					: fieldType === "reference"
						? ["referenceType"]
						: [];
	for (const key of Object.keys(config))
		if (!allowed.includes(key)) fail(`${key} is not valid for ${fieldType}`);

	if (config.maxLength !== undefined)
		assertPositiveInteger(config.maxLength, "maxLength");
	if (config.min !== undefined && !Number.isSafeInteger(config.min))
		fail("min must be a safe integer");
	if (config.max !== undefined && !Number.isSafeInteger(config.max))
		fail("max must be a safe integer");
	if (
		config.min !== undefined &&
		config.max !== undefined &&
		config.min > config.max
	)
		fail("min must not exceed max");
	if (config.options !== undefined) {
		if (
			config.options.length === 0 ||
			config.options.some((option) => !option.trim()) ||
			new Set(config.options).size !== config.options.length
		)
			fail("options must contain unique, non-blank strings");
	}
	if (fieldType === "dropdown" || fieldType === "multiselect") {
		if (!config.options) fail(`${fieldType} requires options`);
	}
	if (fieldType === "reference") {
		if (!config.referenceType) fail("reference requires referenceType");
		assertNonBlank(config.referenceType, "referenceType");
	}
	return config;
}

export function validateFieldValue(
	definition: Pick<FieldDefinition, "key" | "fieldType" | "config">,
	value: unknown,
): unknown {
	const invalid = () =>
		fail(`Invalid value for dynamic field ${definition.key}`);
	const config = validateFieldConfig(definition.fieldType, definition.config);

	switch (definition.fieldType) {
		case "text":
		case "textarea":
		case "reference":
			if (
				typeof value !== "string" ||
				(definition.fieldType === "reference" && !value.trim()) ||
				(config.maxLength !== undefined && value.length > config.maxLength)
			)
				return invalid();
			return value;
		case "integer":
			if (
				!Number.isSafeInteger(value) ||
				(config.min !== undefined && (value as number) < config.min) ||
				(config.max !== undefined && (value as number) > config.max)
			)
				return invalid();
			return value;
		case "date": {
			if (typeof value !== "string") return invalid();
			const match = datePattern.exec(value);
			if (!match) return invalid();
			const year = Number(match[1]);
			const month = Number(match[2]);
			const day = Number(match[3]);
			const parsed = new Date(Date.UTC(year, month - 1, day));
			if (
				parsed.getUTCFullYear() !== year ||
				parsed.getUTCMonth() !== month - 1 ||
				parsed.getUTCDate() !== day
			)
				return invalid();
			return value;
		}
		case "datetime":
			if (
				typeof value !== "string" ||
				!dateTimePattern.test(value) ||
				Number.isNaN(Date.parse(value))
			)
				return invalid();
			return value;
		case "dropdown":
			if (typeof value !== "string" || !config.options?.includes(value))
				return invalid();
			return value;
		case "multiselect":
			if (
				!Array.isArray(value) ||
				value.some(
					(option) =>
						typeof option !== "string" || !config.options?.includes(option),
				) ||
				new Set(value).size !== value.length
			)
				return invalid();
			return value;
		case "checkbox":
			if (typeof value !== "boolean") return invalid();
			return value;
	}
}

export async function createFieldDefinition(
	db: DynamicFieldsDb,
	input: NewFieldDefinition,
) {
	if (!keyPattern.test(input.key))
		fail(
			"key must start with a letter and contain only lowercase letters, digits, or underscores",
		);
	assertNonBlank(input.label, "label");
	assertNonBlank(input.objectType, "objectType");
	const config = validateFieldConfig(input.fieldType, input.config);
	const [created] = await db
		.insert(dynamicFields)
		.values({ ...input, id: randomUUID(), config })
		.returning();
	return created;
}

export async function listActiveFieldDefinitions(
	db: DynamicFieldsDb,
	objectType: string,
) {
	assertNonBlank(objectType, "objectType");
	return db
		.select()
		.from(dynamicFields)
		.where(
			and(
				eq(dynamicFields.objectType, objectType),
				eq(dynamicFields.isActive, true),
			),
		)
		.orderBy(asc(dynamicFields.displayOrder), asc(dynamicFields.key));
}

async function setFieldActive(
	db: DynamicFieldsDb,
	fieldId: string,
	isActive: boolean,
) {
	const [updated] = await db
		.update(dynamicFields)
		.set({ isActive })
		.where(eq(dynamicFields.id, fieldId))
		.returning();
	if (!updated) throw new RangeError(`Dynamic field ${fieldId} was not found`);
	return updated;
}

export const retireFieldDefinition = (db: DynamicFieldsDb, fieldId: string) =>
	setFieldActive(db, fieldId, false);
export const reactivateFieldDefinition = (
	db: DynamicFieldsDb,
	fieldId: string,
) => setFieldActive(db, fieldId, true);

export async function readDynamicFieldValues(
	db: DynamicFieldsDb,
	objectType: string,
	objectId: string,
): Promise<Record<string, unknown>> {
	assertNonBlank(objectId, "objectId");
	const rows = await db
		.select({ key: dynamicFields.key, value: dynamicFieldValues.value })
		.from(dynamicFieldValues)
		.innerJoin(dynamicFields, eq(dynamicFields.id, dynamicFieldValues.fieldId))
		.where(
			and(
				eq(dynamicFields.objectType, objectType),
				eq(dynamicFields.isActive, true),
				eq(dynamicFieldValues.objectId, objectId),
			),
		);
	return Object.fromEntries(rows.map(({ key, value }) => [key, value]));
}

export async function writeDynamicFieldValues(
	db: DynamicFieldsDb,
	objectType: string,
	objectId: string,
	values: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	assertNonBlank(objectType, "objectType");
	assertNonBlank(objectId, "objectId");
	const keys = Object.keys(values);
	if (keys.length === 0)
		return readDynamicFieldValues(db, objectType, objectId);
	const definitions = await db
		.select()
		.from(dynamicFields)
		.where(
			and(
				eq(dynamicFields.objectType, objectType),
				eq(dynamicFields.isActive, true),
				inArray(dynamicFields.key, keys),
			),
		);
	const byKey = new Map(
		definitions.map((definition) => [definition.key, definition]),
	);
	for (const key of keys) {
		const definition = byKey.get(key);
		if (!definition) fail(`Unknown or inactive dynamic field ${key}`);
		if (values[key] !== null) validateFieldValue(definition, values[key]);
	}

	const persist = async (tx: DynamicFieldsDb) => {
		for (const key of keys) {
			const definition = byKey.get(key);
			if (!definition) continue;
			const value = values[key];
			if (value === null) {
				await tx
					.delete(dynamicFieldValues)
					.where(
						and(
							eq(dynamicFieldValues.fieldId, definition.id),
							eq(dynamicFieldValues.objectId, objectId),
						),
					);
			} else {
				await tx
					.insert(dynamicFieldValues)
					.values({ fieldId: definition.id, objectId, value })
					.onConflictDoUpdate({
						target: [dynamicFieldValues.fieldId, dynamicFieldValues.objectId],
						set: { value },
					});
			}
		}
	};
	if ("$client" in db) await db.transaction(persist);
	else await persist(db);
	if (objectType === "asset" && "$client" in db) {
		const { indexAsset } = await import("../search/projections");
		await indexAsset(db, objectId);
	}
	return readDynamicFieldValues(db, objectType, objectId);
}
