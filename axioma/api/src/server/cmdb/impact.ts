import { eq, inArray, or } from "drizzle-orm";
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

function assertDepth(maxDepth: number): void {
	if (!Number.isInteger(maxDepth) || maxDepth < 0)
		throw new Error("maxDepth must be a non-negative integer");
}

/** The object an edge reaches from `objectId`, or undefined when it does not spread that way. */
function impactNeighbour(
	edge: ImpactEdge,
	objectId: string,
): string | undefined {
	if (!edge.spreadsImpact || edge.impactDirection === "none") return undefined;
	if (
		edge.sourceObjectId === objectId &&
		(edge.impactDirection === "forward" || edge.impactDirection === "both")
	)
		return edge.targetObjectId;
	if (
		edge.targetObjectId === objectId &&
		(edge.impactDirection === "reverse" || edge.impactDirection === "both")
	)
		return edge.sourceObjectId;
	return undefined;
}

/** Breadth-first traversal; visited doubles as cycle detection. */
export function traverseImpact(
	startObjectId: string,
	edges: readonly ImpactEdge[],
	maxDepth = 5,
): ImpactNode[] {
	assertDepth(maxDepth);
	const result: ImpactNode[] = [{ objectId: startObjectId, depth: 0 }];
	const visited = new Set([startObjectId]);

	for (let cursor = 0; cursor < result.length; cursor++) {
		const current = result[cursor];
		if (!current || current.depth >= maxDepth) continue;
		for (const edge of edges) {
			const next = impactNeighbour(edge, current.objectId);
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

/**
 * A relationship only carries a class property when one was supplied, and the
 * left join reports spreadsImpact as null otherwise — so the relationship
 * type's own impactDirection is what decides whether an unattached edge
 * spreads. Reading the null as `false` silences every such edge.
 */
const edgeSpreads = (row: {
	spreadsImpact: boolean | null;
	impactDirection: ImpactDirection;
}) => row.spreadsImpact ?? row.impactDirection !== "none";

export async function impactForObject(objectId: string, maxDepth = 5) {
	assertDepth(maxDepth);
	// Expanding one level at a time keeps each query proportional to the frontier
	// rather than to every relationship in the database, and keeps the bind
	// parameters bounded by the ids at that depth rather than by everything
	// visited so far.
	const traversed: ImpactNode[] = [{ objectId, depth: 0 }];
	const visited = new Set([objectId]);
	let frontier = [objectId];

	for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
		const edges = await db
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
			)
			.where(
				or(
					inArray(cmdbObjectRelationships.sourceObjectId, frontier),
					inArray(cmdbObjectRelationships.targetObjectId, frontier),
				),
			);
		const reached: string[] = [];
		for (const current of frontier)
			for (const row of edges) {
				const next = impactNeighbour(
					{ ...row, spreadsImpact: edgeSpreads(row) },
					current,
				);
				if (!next || visited.has(next)) continue;
				visited.add(next);
				reached.push(next);
				traversed.push({
					objectId: next,
					depth: depth + 1,
					viaRelationshipId: row.id,
				});
			}
		frontier = reached;
	}

	const objects = await db
		.select()
		.from(cmdbObjects)
		.where(
			inArray(
				cmdbObjects.id,
				traversed.map((node) => node.objectId),
			),
		);
	const byId = new Map(objects.map((object) => [object.id, object]));
	return traversed.map((node) => ({
		...node,
		object: byId.get(node.objectId) ?? null,
	}));
}
