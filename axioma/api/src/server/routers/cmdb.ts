import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
	cmdbClasses,
	cmdbClassProperties,
	cmdbObjectProperties,
	cmdbObjectRelationships,
	cmdbObjects,
	cmdbRelationshipTypes,
	ticketCmdbObjects,
} from "@/db/schema";
import { impactForObject } from "../cmdb/impact";
import { insertRelationship } from "../cmdb/relationships";
import { capabilityProcedure } from "../orpc";

export const cmdbRouter = {
	listCmdbClasses: capabilityProcedure(
		"ticket.read.all",
	).listCmdbClasses.handler(async () =>
		Promise.all(
			(await db.select().from(cmdbClasses).orderBy(cmdbClasses.key)).map(
				async (row) => ({
					...row,
					properties: await db
						.select()
						.from(cmdbClassProperties)
						.where(eq(cmdbClassProperties.classId, row.id)),
				}),
			),
		),
	),
	createCmdbClass: capabilityProcedure(
		"admin.settings",
	).createCmdbClass.handler(async ({ input }) => {
		const id = crypto.randomUUID();
		await db.transaction(async (tx) => {
			await tx.insert(cmdbClasses).values({
				id,
				key: input.key,
				label: input.label,
				parentClassId: input.parentClassId,
			});
			if (input.properties.length)
				await tx.insert(cmdbClassProperties).values(
					input.properties.map((property) => ({
						...property,
						id: crypto.randomUUID(),
						classId: id,
					})),
				);
		});
		const [row] = await db
			.select()
			.from(cmdbClasses)
			.where(eq(cmdbClasses.id, id))
			.limit(1);
		if (!row) throw new Error("CMDB class insert failed");
		return {
			...row,
			properties: await db
				.select()
				.from(cmdbClassProperties)
				.where(eq(cmdbClassProperties.classId, id)),
		};
	}),
	updateCmdbClass: capabilityProcedure(
		"admin.settings",
	).updateCmdbClass.handler(async ({ input }) => {
		// A null parentClassId detaches the class, so only an absent key means
		// "leave alone". cmdb_classes carries no updatedAt to stamp, so an id-only
		// patch — which the contract permits — is answered with the row as it
		// stands rather than an empty update drizzle refuses to build.
		const patch = {
			...(input.label === undefined ? {} : { label: input.label }),
			...(input.parentClassId === undefined
				? {}
				: { parentClassId: input.parentClassId }),
		};
		const [row] = Object.keys(patch).length
			? await db
					.update(cmdbClasses)
					.set(patch)
					.where(eq(cmdbClasses.id, input.id))
					.returning()
			: await db
					.select()
					.from(cmdbClasses)
					.where(eq(cmdbClasses.id, input.id))
					.limit(1);
		if (!row) throw new ORPCError("NOT_FOUND");
		return row;
	}),
	deleteCmdbClass: capabilityProcedure(
		"admin.settings",
	).deleteCmdbClass.handler(async ({ input }) => ({
		deleted: Boolean(
			(
				await db
					.delete(cmdbClasses)
					.where(eq(cmdbClasses.id, input.id))
					.returning()
			)[0],
		),
	})),
	listCmdbObjects: capabilityProcedure(
		"ticket.read.all",
	).listCmdbObjects.handler(({ input }) =>
		db
			.select()
			.from(cmdbObjects)
			.where(input.classId ? eq(cmdbObjects.classId, input.classId) : undefined)
			.orderBy(desc(cmdbObjects.observedAt))
			.limit(input.limit),
	),
	getCmdbObject: capabilityProcedure("ticket.read.all").getCmdbObject.handler(
		async ({ input }) => {
			const [row] = await db
				.select({
					object: cmdbObjects,
					classKey: cmdbClasses.key,
					classLabel: cmdbClasses.label,
				})
				.from(cmdbObjects)
				.innerJoin(cmdbClasses, eq(cmdbObjects.classId, cmdbClasses.id))
				.where(eq(cmdbObjects.id, input.id))
				.limit(1);
			if (!row) return null;
			// A relationship reads in both directions, and which verb applies
			// depends on which end this object sits at, so the two halves are
			// fetched separately and each keeps the verb that describes it.
			const [properties, outgoing, incoming] = await Promise.all([
				db
					.select({
						id: cmdbObjectProperties.id,
						propertyKey: cmdbClassProperties.propertyKey,
						label: cmdbClassProperties.label,
						propertyType: cmdbClassProperties.propertyType,
						value: cmdbObjectProperties.value,
					})
					.from(cmdbObjectProperties)
					.innerJoin(
						cmdbClassProperties,
						eq(cmdbObjectProperties.propertyId, cmdbClassProperties.id),
					)
					.where(eq(cmdbObjectProperties.objectId, input.id))
					.orderBy(cmdbClassProperties.propertyKey),
				db
					.select({
						id: cmdbObjectRelationships.id,
						verb: cmdbRelationshipTypes.verb,
						objectId: cmdbObjects.id,
						objectName: cmdbObjects.name,
					})
					.from(cmdbObjectRelationships)
					.innerJoin(
						cmdbRelationshipTypes,
						eq(cmdbObjectRelationships.typeId, cmdbRelationshipTypes.id),
					)
					.innerJoin(
						cmdbObjects,
						eq(cmdbObjectRelationships.targetObjectId, cmdbObjects.id),
					)
					.where(eq(cmdbObjectRelationships.sourceObjectId, input.id)),
				db
					.select({
						id: cmdbObjectRelationships.id,
						verb: cmdbRelationshipTypes.inverseVerb,
						objectId: cmdbObjects.id,
						objectName: cmdbObjects.name,
					})
					.from(cmdbObjectRelationships)
					.innerJoin(
						cmdbRelationshipTypes,
						eq(cmdbObjectRelationships.typeId, cmdbRelationshipTypes.id),
					)
					.innerJoin(
						cmdbObjects,
						eq(cmdbObjectRelationships.sourceObjectId, cmdbObjects.id),
					)
					.where(eq(cmdbObjectRelationships.targetObjectId, input.id)),
			]);
			return {
				...row.object,
				classKey: row.classKey,
				classLabel: row.classLabel,
				properties,
				relationships: [
					...outgoing.map((edge) => ({
						...edge,
						direction: "outgoing" as const,
					})),
					...incoming.map((edge) => ({
						...edge,
						direction: "incoming" as const,
					})),
				],
			};
		},
	),
	cmdbImpact: capabilityProcedure("ticket.read.all").cmdbImpact.handler(
		({ input }) => impactForObject(input.objectId, input.maxDepth),
	),
	listCmdbRelationshipTypes: capabilityProcedure(
		"ticket.read.all",
	).listCmdbRelationshipTypes.handler(() =>
		db.select().from(cmdbRelationshipTypes).orderBy(cmdbRelationshipTypes.key),
	),
	createCmdbRelationshipType: capabilityProcedure(
		"admin.settings",
	).createCmdbRelationshipType.handler(async ({ input }) => {
		const [row] = await db
			.insert(cmdbRelationshipTypes)
			.values({ id: crypto.randomUUID(), ...input })
			.returning();
		if (!row) throw new Error("CMDB relationship type insert failed");
		return row;
	}),
	createCmdbObjectRelationship: capabilityProcedure(
		"admin.settings",
	).createCmdbObjectRelationship.handler(async ({ input }) => {
		const result = await insertRelationship(db, input);
		if (!result.ok)
			throw new ORPCError("BAD_REQUEST", { message: result.error.message });
		return result;
	}),
	listTicketCmdbObjects: capabilityProcedure(
		"ticket.read.all",
	).listTicketCmdbObjects.handler(({ input }) =>
		db
			.select({
				id: cmdbObjects.id,
				classId: cmdbObjects.classId,
				externalId: cmdbObjects.externalId,
				name: cmdbObjects.name,
				sourceTicketId: cmdbObjects.sourceTicketId,
				sourceRunId: cmdbObjects.sourceRunId,
				sourceStepId: cmdbObjects.sourceStepId,
				observedAt: cmdbObjects.observedAt,
			})
			.from(ticketCmdbObjects)
			.innerJoin(cmdbObjects, eq(ticketCmdbObjects.objectId, cmdbObjects.id))
			.where(eq(ticketCmdbObjects.ticketId, input.ticketId)),
	),
	linkTicketCmdbObject: capabilityProcedure(
		"admin.settings",
	).linkTicketCmdbObject.handler(async ({ input }) => {
		await db.insert(ticketCmdbObjects).values(input).onConflictDoNothing();
		return { linked: true as const };
	}),
	unlinkTicketCmdbObject: capabilityProcedure(
		"admin.settings",
	).unlinkTicketCmdbObject.handler(async ({ input }) => ({
		deleted: Boolean(
			(
				await db
					.delete(ticketCmdbObjects)
					.where(
						and(
							eq(ticketCmdbObjects.ticketId, input.ticketId),
							eq(ticketCmdbObjects.objectId, input.objectId),
						),
					)
					.returning()
			)[0],
		),
	})),
};
