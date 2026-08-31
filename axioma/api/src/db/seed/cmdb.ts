/**
 * CMDB seed — 8 CI objects + 6 relationships.
 * Uses baseline cmdbClasses / cmdbRelationshipTypes.
 * Early, independent of users/tickets (except source_ticket_id which stays null).
 */

import { db } from "@/db";
import {
	cmdbClasses,
	cmdbObjectRelationships,
	cmdbObjects,
	cmdbRelationshipTypes,
} from "@/db/schema/cmdb";
import { CMDB_OBJECTS, CMDB_RELATIONSHIPS, SEED_EPOCH } from "./data";

export async function seedCmdb(): Promise<void> {
	await db.transaction(async (tx) => {
		// Resolve class keys -> ids from baseline
		const classRows = await tx
			.select({ id: cmdbClasses.id, key: cmdbClasses.key })
			.from(cmdbClasses);
		const classByKey = new Map(classRows.map((r) => [r.key, r.id]));

		const relRows = await tx
			.select({ id: cmdbRelationshipTypes.id, key: cmdbRelationshipTypes.key })
			.from(cmdbRelationshipTypes);
		const relByKey = new Map(relRows.map((r) => [r.key, r.id]));

		for (const [i, obj] of CMDB_OBJECTS.entries()) {
			const classId = classByKey.get(obj.classKey);
			if (!classId) {
				console.warn(
					`[seed:cmdb] class ${obj.classKey} not found, skipping ${obj.id}`,
				);
				continue;
			}
			// Stagger observedAt for realism but deterministic
			const observedAt = new Date(SEED_EPOCH.getTime() + i * 3_600_000);
			await tx
				.insert(cmdbObjects)
				.values({
					id: obj.id,
					classId,
					externalId: obj.externalId,
					name: obj.name,
					observedAt,
				})
				.onConflictDoNothing();
		}

		for (const rel of CMDB_RELATIONSHIPS) {
			const typeId = relByKey.get(rel.typeKey);
			if (!typeId) {
				console.warn(`[seed:cmdb] relationship type ${rel.typeKey} not found`);
				continue;
			}
			await tx
				.insert(cmdbObjectRelationships)
				.values({
					id: rel.id,
					typeId,
					sourceObjectId: rel.sourceId,
					targetObjectId: rel.targetId,
				})
				.onConflictDoNothing();
		}
	});

	console.log("[seed:cmdb] seeded 8 objects + 6 relationships");
}
