import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
	cmdbClasses,
	cmdbClassProperties,
	cmdbObjects,
	ticketCmdbObjects,
} from "@/db/schema";
import { impactForObject } from "../cmdb/impact";
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
		return {
			...(
				await db
					.select()
					.from(cmdbClasses)
					.where(eq(cmdbClasses.id, id))
					.limit(1)
			)[0]!,
			properties: await db
				.select()
				.from(cmdbClassProperties)
				.where(eq(cmdbClassProperties.classId, id)),
		};
	}),
	updateCmdbClass: capabilityProcedure(
		"admin.settings",
	).updateCmdbClass.handler(async ({ input }) => {
		const [row] = await db
			.update(cmdbClasses)
			.set({ label: input.label, parentClassId: input.parentClassId })
			.where(eq(cmdbClasses.id, input.id))
			.returning();
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
	cmdbImpact: capabilityProcedure("ticket.read.all").cmdbImpact.handler(
		({ input }) => impactForObject(input.objectId, input.maxDepth),
	),
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
