import { and, eq, inArray, or, type SQL } from "drizzle-orm";

import type { createDb } from "@/db";
import { savedViews } from "@/db/schema/views";

type Db = ReturnType<typeof createDb>;

export interface SavedViewScope {
	userId: string;
	teamIds: readonly string[];
}

/** Visibility is always derived from the caller, never accepted as a free-form filter. */
export function savedViewScope({ userId, teamIds }: SavedViewScope): SQL {
	return or(
		and(eq(savedViews.ownerType, "user"), eq(savedViews.ownerId, userId)),
		teamIds.length
			? and(
					eq(savedViews.ownerType, "team"),
					inArray(savedViews.ownerId, [...teamIds]),
				)
			: undefined,
	) as SQL;
}

export function canAccessSavedView(
	view: { ownerType: "user" | "team"; ownerId: string },
	scope: SavedViewScope,
): boolean {
	return view.ownerType === "user"
		? view.ownerId === scope.userId
		: scope.teamIds.includes(view.ownerId);
}

export async function listSavedViews(db: Db, scope: SavedViewScope) {
	return db
		.select()
		.from(savedViews)
		.where(savedViewScope(scope))
		.orderBy(savedViews.name);
}
