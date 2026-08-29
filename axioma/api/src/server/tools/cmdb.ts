import { desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
	cmdbClasses,
	cmdbClassProperties,
	cmdbObjectProperties,
	cmdbObjectRelationships,
	cmdbObjects,
	cmdbRelationshipTypes,
} from "@/db/schema/cmdb";
import { ticketCmdbObjects } from "@/db/schema/cmdb-links";
import { impactForObject } from "@/server/cmdb/impact";
import { indexCmdbObject } from "@/server/search/projections";

const attributesInput = z.record(z.string(), z.unknown());
export const recordObservationInput = z.object({
	class_key: z.string().min(1),
	external_id: z.string().min(1),
	name: z.string().min(1),
	attributes: attributesInput.nullable().optional(),
	relationships: z
		.array(
			z.object({
				type_key: z.string().min(1),
				target_object_id: z.string().min(1),
				property_key: z.string().min(1).nullable().optional(),
			}),
		)
		.optional(),
});

export const impactInput = z.object({
	object_id: z.string().min(1),
	max_depth: z.number().int().min(0).max(10).default(5),
});

export type CmdbValidationError = {
	code:
		| "unknown_class"
		| "unknown_property"
		| "missing_property"
		| "invalid_property_type";
	message: string;
	classKey: string;
	propertyKey?: string;
	expectedType?: string;
};

type PropertyDefinition = {
	id: string;
	propertyKey: string;
	propertyType: string;
	isRequired: boolean;
};

function matchesPropertyType(type: string, value: unknown) {
	switch (type) {
		case "string":
		case "text":
		case "date":
		case "datetime":
		case "reference":
			return typeof value === "string";
		case "integer":
			return typeof value === "number" && Number.isInteger(value);
		case "number":
			return typeof value === "number" && Number.isFinite(value);
		case "boolean":
			return typeof value === "boolean";
		case "json":
			return value !== undefined;
		default:
			return false;
	}
}

export function validateAttributes(
	classKey: string,
	attributes: Record<string, unknown>,
	properties: readonly PropertyDefinition[],
): CmdbValidationError[] {
	const declared = new Map(
		properties.map((property) => [property.propertyKey, property]),
	);
	const errors: CmdbValidationError[] = [];
	for (const key of Object.keys(attributes)) {
		const property = declared.get(key);
		if (!property)
			errors.push({
				code: "unknown_property",
				message: `Class "${classKey}" does not declare property "${key}"`,
				classKey,
				propertyKey: key,
			});
		else if (!matchesPropertyType(property.propertyType, attributes[key]))
			errors.push({
				code: "invalid_property_type",
				message: `Property "${key}" on class "${classKey}" must be ${property.propertyType}`,
				classKey,
				propertyKey: key,
				expectedType: property.propertyType,
			});
	}
	for (const property of properties)
		if (property.isRequired && !(property.propertyKey in attributes))
			errors.push({
				code: "missing_property",
				message: `Class "${classKey}" requires property "${property.propertyKey}"`,
				classKey,
				propertyKey: property.propertyKey,
			});
	return errors;
}

export async function recordObservation(
	input: z.infer<typeof recordObservationInput>,
	ctx: { ticketId: string; runId: string; stepId: string },
) {
	const [cmdbClass] = await db
		.select()
		.from(cmdbClasses)
		.where(eq(cmdbClasses.key, input.class_key))
		.limit(1);
	if (!cmdbClass)
		return {
			ok: false as const,
			error: {
				code: "unknown_class",
				message: `CMDB class "${input.class_key}" does not exist`,
				classKey: input.class_key,
			} satisfies CmdbValidationError,
		};

	const properties = await db
		.select({
			id: cmdbClassProperties.id,
			propertyKey: cmdbClassProperties.propertyKey,
			propertyType: cmdbClassProperties.propertyType,
			isRequired: cmdbClassProperties.isRequired,
		})
		.from(cmdbClassProperties)
		.where(eq(cmdbClassProperties.classId, cmdbClass.id));
	const attributes = input.attributes ?? {};
	const errors = validateAttributes(input.class_key, attributes, properties);
	const byKey = new Map(
		properties.map((property) => [property.propertyKey, property]),
	);
	for (const relationship of input.relationships ?? [])
		if (relationship.property_key && !byKey.has(relationship.property_key))
			errors.push({
				code: "unknown_property",
				message: `Class "${input.class_key}" does not declare property "${relationship.property_key}"`,
				classKey: input.class_key,
				propertyKey: relationship.property_key,
			});
	if (errors.length) return { ok: false as const, error: errors[0], errors };

	const relationshipFilter = or(
		...(input.relationships ?? []).map((relationship) =>
			eq(cmdbRelationshipTypes.key, relationship.type_key),
		),
	);
	const relationshipTypes = relationshipFilter
		? await db.select().from(cmdbRelationshipTypes).where(relationshipFilter)
		: [];
	const typesByKey = new Map(relationshipTypes.map((type) => [type.key, type]));
	for (const relationship of input.relationships ?? [])
		if (!typesByKey.has(relationship.type_key))
			return {
				ok: false as const,
				error: {
					code: "unknown_relationship_type",
					typeKey: relationship.type_key,
				},
			};

	const id = crypto.randomUUID();
	await db.transaction(async (tx) => {
		await tx.insert(cmdbObjects).values({
			id,
			classId: cmdbClass.id,
			externalId: input.external_id,
			name: input.name,
			sourceTicketId: ctx.ticketId,
			sourceRunId: ctx.runId,
			sourceStepId: ctx.stepId,
		});
		const values = Object.entries(attributes).map(([key, value]) => ({
			id: crypto.randomUUID(),
			objectId: id,
			propertyId: byKey.get(key)?.id ?? "",
			value,
		}));
		if (values.length) await tx.insert(cmdbObjectProperties).values(values);
		const relationships = (input.relationships ?? []).map((relationship) => ({
			id: crypto.randomUUID(),
			typeId: typesByKey.get(relationship.type_key)?.id ?? "",
			sourceObjectId: id,
			targetObjectId: relationship.target_object_id,
			propertyId: relationship.property_key
				? byKey.get(relationship.property_key)?.id
				: undefined,
		}));
		if (relationships.length)
			await tx.insert(cmdbObjectRelationships).values(relationships);
		await tx
			.insert(ticketCmdbObjects)
			.values({ ticketId: ctx.ticketId, objectId: id })
			.onConflictDoNothing();
	});
	try {
		await indexCmdbObject(db, id);
	} catch (error) {
		console.error("[cmdb] search indexing failed", error);
	}
	return { ok: true as const, id };
}

export async function readContextForTicket(
	ticketId: string,
	deviceId?: string | null,
) {
	const rows = await db
		.select({ object: cmdbObjects, classKey: cmdbClasses.key })
		.from(cmdbObjects)
		.innerJoin(cmdbClasses, eq(cmdbObjects.classId, cmdbClasses.id))
		.leftJoin(ticketCmdbObjects, eq(ticketCmdbObjects.objectId, cmdbObjects.id))
		.where(
			deviceId
				? sql`${ticketCmdbObjects.ticketId} = ${ticketId} or (${cmdbClasses.key} = 'PC' and ${cmdbObjects.externalId} = ${deviceId})`
				: eq(ticketCmdbObjects.ticketId, ticketId),
		)
		.orderBy(desc(cmdbObjects.observedAt));
	const newest = new Map<string, (typeof rows)[number]>();
	for (const row of rows) {
		const key = `${row.classKey}\0${row.object.externalId}`;
		if (!newest.has(key)) newest.set(key, row);
	}
	return [...newest.values()];
}

export async function cmdbImpact(input: z.infer<typeof impactInput>) {
	return impactForObject(input.object_id, input.max_depth);
}
