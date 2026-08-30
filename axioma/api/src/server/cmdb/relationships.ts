import { eq, inArray } from "drizzle-orm";
import type { db as database } from "@/db";
import {
	cmdbClasses,
	cmdbClassProperties,
	cmdbObjectRelationships,
	cmdbObjects,
} from "@/db/schema/cmdb";

type Db = Pick<typeof database, "select" | "insert">;

export type RelationshipInput = {
	id?: string;
	typeId: string;
	sourceObjectId: string;
	targetObjectId: string;
	propertyId?: string | null;
};

export type RelationshipValidationError = {
	code: "invalid_relationship_property" | "incompatible_relationship_target";
	message: string;
	propertyId: string;
	expectedClassId?: string;
	actualClassId?: string;
};

export function validateRelationshipProperty(
	property: {
		id: string;
		classId: string;
		propertyType: string;
		targetClassId: string | null;
	},
	sourceClassId: string,
	targetClassId: string,
	compatibleTargetClassIds: ReadonlySet<string>,
): RelationshipValidationError | null {
	if (
		property.propertyType !== "reference" ||
		property.classId !== sourceClassId
	)
		return {
			code: "invalid_relationship_property",
			message: `Relationship property "${property.id}" must be a reference property declared on the source object's class`,
			propertyId: property.id,
		};
	if (
		property.targetClassId &&
		!compatibleTargetClassIds.has(property.targetClassId)
	)
		return {
			code: "incompatible_relationship_target",
			message: `Relationship property "${property.id}" targets class "${property.targetClassId}", not target object's class "${targetClassId}"`,
			propertyId: property.id,
			expectedClassId: property.targetClassId,
			actualClassId: targetClassId,
		};
	return null;
}

async function targetClassLineage(db: Db, classId: string) {
	const lineage = new Set([classId]);
	let frontier = [classId];
	while (frontier.length) {
		const parents = (
			await db
				.select({ parentClassId: cmdbClasses.parentClassId })
				.from(cmdbClasses)
				.where(inArray(cmdbClasses.id, frontier))
		)
			.map(({ parentClassId }) => parentClassId)
			.filter((id): id is string => id !== null)
			.filter((id) => !lineage.has(id));
		for (const id of parents) lineage.add(id);
		frontier = parents;
	}
	return lineage;
}

export async function validateRelationship(db: Db, input: RelationshipInput) {
	if (!input.propertyId) return null;
	const [[property], objects] = await Promise.all([
		db
			.select({
				id: cmdbClassProperties.id,
				classId: cmdbClassProperties.classId,
				propertyType: cmdbClassProperties.propertyType,
				targetClassId: cmdbClassProperties.targetClassId,
			})
			.from(cmdbClassProperties)
			.where(eq(cmdbClassProperties.id, input.propertyId))
			.limit(1),
		db
			.select({ id: cmdbObjects.id, classId: cmdbObjects.classId })
			.from(cmdbObjects)
			.where(
				inArray(cmdbObjects.id, [input.sourceObjectId, input.targetObjectId]),
			),
	]);
	if (!property)
		return {
			code: "invalid_relationship_property" as const,
			message: `Relationship property "${input.propertyId}" does not exist`,
			propertyId: input.propertyId,
		};
	const byId = new Map(objects.map((object) => [object.id, object.classId]));
	const sourceClassId = byId.get(input.sourceObjectId);
	const targetClassId = byId.get(input.targetObjectId);
	if (!sourceClassId || !targetClassId) return null; // Foreign keys report missing objects.
	return validateRelationshipProperty(
		property,
		sourceClassId,
		targetClassId,
		await targetClassLineage(db, targetClassId),
	);
}

export async function insertRelationship(db: Db, input: RelationshipInput) {
	const error = await validateRelationship(db, input);
	if (error) return { ok: false as const, error };
	const [relationship] = await db
		.insert(cmdbObjectRelationships)
		.values({ ...input, id: input.id ?? crypto.randomUUID() })
		.returning();
	if (!relationship) throw new Error("CMDB relationship insert failed");
	return { ok: true as const, relationship };
}
