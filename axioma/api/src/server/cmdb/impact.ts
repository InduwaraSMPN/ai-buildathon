import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import {
	cmdbClassProperties,
	cmdbObjectRelationships,
	cmdbObjects,
	cmdbRelationshipTypes,
} from "@/db/schema/cmdb";

export type ImpactDirection = "forward" | "reverse" | "both" | "none";
export type ImpactEdge = {
	id: string;
	sourceObjectId: string;
	targetObjectId: string;
	impactDirection: ImpactDirection;
	spreadsImpact: boolean;
};
export type ImpactNode = {
	objectId: string;
	depth: number;
	viaRelationshipId?: string;
};

/** Breadth-first traversal; visited doubles as cycle detection. */
export function traverseImpact(
	startObjectId: string,
	edges: readonly ImpactEdge[],
	maxDepth = 5,
): ImpactNode[] {
	if (!Number.isInteger(maxDepth) || maxDepth < 0)
		throw new Error("maxDepth must be a non-negative integer");
	const result: ImpactNode[] = [{ objectId: startObjectId, depth: 0 }];
	const visited = new Set([startObjectId]);

	for (let cursor = 0; cursor < result.length; cursor++) {
		const current = result[cursor];
		if (!current || current.depth >= maxDepth) continue;
		for (const edge of edges) {
			if (!edge.spreadsImpact || edge.impactDirection === "none") continue;
			let next: string | undefined;
			if (
				edge.sourceObjectId === current.objectId &&
				(edge.impactDirection === "forward" || edge.impactDirection === "both")
			)
				next = edge.targetObjectId;
			else if (
				edge.targetObjectId === current.objectId &&
				(edge.impactDirection === "reverse" || edge.impactDirection === "both")
			)
				next = edge.sourceObjectId;
			if (next && !visited.has(next)) {
				visited.add(next);
				result.push({
					objectId: next,
					depth: current.depth + 1,
					viaRelationshipId: edge.id,
				});
			}
		}
	}
	return result;
}

export async function impactForObject(objectId: string, maxDepth = 5) {
	const relationships = await db
		.select({
			id: cmdbObjectRelationships.id,
			sourceObjectId: cmdbObjectRelationships.sourceObjectId,
			targetObjectId: cmdbObjectRelationships.targetObjectId,
			impactDirection: cmdbRelationshipTypes.impactDirection,
			spreadsImpact: cmdbClassProperties.spreadsImpact,
		})
		.from(cmdbObjectRelationships)
		.innerJoin(
			cmdbRelationshipTypes,
			eq(cmdbObjectRelationships.typeId, cmdbRelationshipTypes.id),
		)
		.leftJoin(
			cmdbClassProperties,
			eq(cmdbObjectRelationships.propertyId, cmdbClassProperties.id),
		);
	const traversed = traverseImpact(
		objectId,
		relationships.map((row) => ({
			...row,
			spreadsImpact: row.spreadsImpact ?? false,
		})),
		maxDepth,
	);
	const ids = traversed.map((node) => node.objectId);
	const objectFilter = or(...ids.map((id) => eq(cmdbObjects.id, id)));
	const objects = objectFilter
		? await db.select().from(cmdbObjects).where(objectFilter)
		: [];
	const byId = new Map(objects.map((object) => [object.id, object]));
	return traversed.map((node) => ({
		...node,
		object: byId.get(node.objectId) ?? null,
	}));
}
