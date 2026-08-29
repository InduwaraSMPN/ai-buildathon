import { ORPCError } from "@orpc/server";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	apiKeys,
	cmdbClasses,
	cmdbClassProperties,
	cmdbObjects,
	notifications,
	savedViews,
	teamMembers,
	ticketCmdbObjects,
	ticketRules,
	webhookDeliveries,
	workflows,
} from "@/db/schema";
import { createApiKey, validateCapabilitySubset } from "../api-keys/core";
import { impactForObject } from "../cmdb/impact";
import {
	createFieldDefinition,
	listActiveFieldDefinitions,
	reactivateFieldDefinition,
	retireFieldDefinition,
} from "../dynamic-fields";
import { anyCapabilityProcedure, capabilityProcedure } from "../orpc";
import type { RuleAction, RuleCriterion } from "../rules";
import { search as searchDocuments } from "../search";
import { reconcileCoreSearchDocuments } from "../search/projections";
import { canAccessSavedView, listSavedViews } from "../search/views";
import { sweepWebhookDeliveries } from "../workflows/webhooks";

async function savedViewContext(userId: string) {
	return {
		userId,
		teamIds: (
			await db
				.select({ teamId: teamMembers.teamId })
				.from(teamMembers)
				.where(eq(teamMembers.userId, userId))
		).map(({ teamId }) => teamId),
	};
}

export const tier3Router = {
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
	listFieldDefinitions: capabilityProcedure(
		"ticket.read.all",
	).listFieldDefinitions.handler(({ input }) =>
		listActiveFieldDefinitions(db, input.objectType),
	),
	createFieldDefinition: capabilityProcedure(
		"admin.settings",
	).createFieldDefinition.handler(async ({ input }) => {
		const row = await createFieldDefinition(db, input);
		if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return row;
	}),
	setFieldDefinitionActive: capabilityProcedure(
		"admin.settings",
	).setFieldDefinitionActive.handler(({ input }) =>
		input.active
			? reactivateFieldDefinition(db, input.id)
			: retireFieldDefinition(db, input.id),
	),
	listTicketRules: capabilityProcedure(
		"ticket.read.all",
	).listTicketRules.handler(() =>
		db.select().from(ticketRules).orderBy(ticketRules.position),
	),
	createTicketRule: capabilityProcedure(
		"admin.settings",
	).createTicketRule.handler(
		async ({ input }) =>
			(
				await db
					.insert(ticketRules)
					.values({
						id: crypto.randomUUID(),
						...input,
						criteria: input.criteria as RuleCriterion[],
						actions: input.actions as RuleAction[],
					})
					.returning()
			)[0]!,
	),
	updateTicketRule: capabilityProcedure(
		"admin.settings",
	).updateTicketRule.handler(async ({ input: { id, ...patch } }) => {
		const [row] = await db
			.update(ticketRules)
			.set({
				...patch,
				criteria: patch.criteria as RuleCriterion[] | undefined,
				actions: patch.actions as RuleAction[] | undefined,
			})
			.where(eq(ticketRules.id, id))
			.returning();
		if (!row) throw new ORPCError("NOT_FOUND");
		return row;
	}),
	deleteTicketRule: capabilityProcedure(
		"admin.settings",
	).deleteTicketRule.handler(async ({ input }) => ({
		deleted: Boolean(
			(
				await db
					.delete(ticketRules)
					.where(eq(ticketRules.id, input.id))
					.returning()
			)[0],
		),
	})),
	listWorkflows: capabilityProcedure("ticket.read.all").listWorkflows.handler(
		() => db.select().from(workflows).orderBy(workflows.name),
	),
	createWorkflow: capabilityProcedure("admin.settings").createWorkflow.handler(
		async ({ input }) =>
			(
				await db
					.insert(workflows)
					.values({ id: crypto.randomUUID(), ...input })
					.returning()
			)[0]!,
	),
	updateWorkflow: capabilityProcedure("admin.settings").updateWorkflow.handler(
		async ({ input: { id, ...patch } }) => {
			const [row] = await db
				.update(workflows)
				.set(patch)
				.where(eq(workflows.id, id))
				.returning();
			if (!row) throw new ORPCError("NOT_FOUND");
			return row;
		},
	),
	deleteWorkflow: capabilityProcedure("admin.settings").deleteWorkflow.handler(
		async ({ input }) => ({
			deleted: Boolean(
				(
					await db
						.delete(workflows)
						.where(eq(workflows.id, input.id))
						.returning()
				)[0],
			),
		}),
	),
	listWebhookDeliveries: capabilityProcedure(
		"ticket.read.all",
	).listWebhookDeliveries.handler(({ input }) =>
		db
			.select()
			.from(webhookDeliveries)
			.orderBy(desc(webhookDeliveries.createdAt))
			.limit(input.limit),
	),
	retryWebhookDeliveries: capabilityProcedure(
		"admin.settings",
	).retryWebhookDeliveries.handler(async ({ input }) => ({
		processed: (await sweepWebhookDeliveries(db, input.limit)).length,
	})),
	listNotifications: anyCapabilityProcedure(
		"ticket.read.own",
		"ticket.read.all",
	).listNotifications.handler(({ context }) =>
		db
			.select()
			.from(notifications)
			.where(eq(notifications.recipientId, context.userId))
			.orderBy(desc(notifications.updatedAt)),
	),
	markNotificationRead: anyCapabilityProcedure(
		"ticket.read.own",
		"ticket.read.all",
	).markNotificationRead.handler(async ({ context, input }) => {
		const [row] = await db
			.update(notifications)
			.set({ readAt: new Date() })
			.where(
				and(
					eq(notifications.id, input.id),
					eq(notifications.recipientId, context.userId),
				),
			)
			.returning();
		if (!row) throw new ORPCError("NOT_FOUND");
		return row;
	}),
	listSavedViews: capabilityProcedure("ticket.read.all").listSavedViews.handler(
		async ({ context }) =>
			listSavedViews(db, await savedViewContext(context.userId)),
	),
	createSavedView: capabilityProcedure(
		"admin.settings",
	).createSavedView.handler(async ({ context, input }) => {
		const ownerType = input.ownerType ?? "user";
		const ownerId = input.ownerId ?? context.userId;
		if (
			!canAccessSavedView(
				{ ownerType, ownerId },
				await savedViewContext(context.userId),
			)
		)
			throw new ORPCError("FORBIDDEN");
		return (
			await db
				.insert(savedViews)
				.values({
					id: crypto.randomUUID(),
					...input,
					ownerType,
					ownerId,
					createdById: context.userId,
				})
				.returning()
		)[0]!;
	}),
	updateSavedView: capabilityProcedure(
		"admin.settings",
	).updateSavedView.handler(async ({ context, input: { id, ...patch } }) => {
		const current = (
			await db.select().from(savedViews).where(eq(savedViews.id, id)).limit(1)
		)[0];
		if (
			!current ||
			!canAccessSavedView(current, await savedViewContext(context.userId))
		)
			throw new ORPCError("NOT_FOUND");
		return (
			await db
				.update(savedViews)
				.set(patch)
				.where(eq(savedViews.id, id))
				.returning()
		)[0]!;
	}),
	deleteSavedView: capabilityProcedure(
		"admin.settings",
	).deleteSavedView.handler(async ({ context, input }) => {
		const [current] = await db
			.select()
			.from(savedViews)
			.where(eq(savedViews.id, input.id))
			.limit(1);
		if (
			!current ||
			!canAccessSavedView(current, await savedViewContext(context.userId))
		)
			return { deleted: false };
		return {
			deleted: Boolean(
				(
					await db
						.delete(savedViews)
						.where(eq(savedViews.id, input.id))
						.returning()
				)[0],
			),
		};
	}),
	reconcileSearch: capabilityProcedure(
		"admin.settings",
	).reconcileSearch.handler(async ({ input }) => ({
		indexed: await reconcileCoreSearchDocuments(db, input.since),
	})),
	listApiKeys: capabilityProcedure("ticket.read.all").listApiKeys.handler(
		({ context }) =>
			db
				.select({
					id: apiKeys.id,
					userId: apiKeys.userId,
					name: apiKeys.name,
					prefix: apiKeys.prefix,
					capabilities: apiKeys.capabilities,
					expiresAt: apiKeys.expiresAt,
					lastUsedAt: apiKeys.lastUsedAt,
					revokedAt: apiKeys.revokedAt,
					createdAt: apiKeys.createdAt,
				})
				.from(apiKeys)
				.where(eq(apiKeys.userId, context.userId))
				.orderBy(desc(apiKeys.createdAt)),
	),
	createApiKey: capabilityProcedure("admin.settings").createApiKey.handler(
		async ({ context, input }) => {
			try {
				const created = createApiKey({
					...input,
					userId: context.userId,
					issuerCapabilities: context.capabilities,
				});
				const [apiKey] = await db
					.insert(apiKeys)
					.values(created.record)
					.returning();
				if (!apiKey) throw new Error("API key insert failed");
				const { secretHash: _secretHash, ...safe } = apiKey;
				return { token: created.token, apiKey: safe };
			} catch (error) {
				throw new ORPCError("BAD_REQUEST", {
					message: error instanceof Error ? error.message : String(error),
				});
			}
		},
	),
	updateApiKey: capabilityProcedure("admin.settings").updateApiKey.handler(
		async ({ context, input: { id, ...patch } }) => {
			if (patch.expiresAt && patch.expiresAt <= new Date())
				throw new ORPCError("BAD_REQUEST", {
					message: "API key expiry must be in the future",
				});
			let capabilities = patch.capabilities;
			try {
				if (capabilities)
					capabilities = validateCapabilitySubset(
						capabilities,
						context.capabilities,
					);
			} catch (error) {
				throw new ORPCError("BAD_REQUEST", {
					message: error instanceof Error ? error.message : String(error),
				});
			}
			const [row] = await db
				.update(apiKeys)
				.set({ ...patch, capabilities })
				.where(and(eq(apiKeys.id, id), eq(apiKeys.userId, context.userId)))
				.returning();
			if (!row) throw new ORPCError("NOT_FOUND");
			const { secretHash: _secretHash, ...safe } = row;
			return safe;
		},
	),
	revokeApiKey: capabilityProcedure("admin.settings").revokeApiKey.handler(
		async ({ context, input }) => {
			const [row] = await db
				.update(apiKeys)
				.set({ revokedAt: new Date() })
				.where(
					and(eq(apiKeys.id, input.id), eq(apiKeys.userId, context.userId)),
				)
				.returning();
			if (!row) throw new ORPCError("NOT_FOUND");
			const { secretHash: _secretHash, ...safe } = row;
			return safe;
		},
	),
	search: anyCapabilityProcedure(
		"ticket.read.own",
		"ticket.read.all",
		"knowledge.read",
	).search.handler(({ context, input }) =>
		searchDocuments(
			db,
			input,
			(document) =>
				or(
					and(
						sql`${document.objectType} = 'ticket'`,
						sql`exists (select 1 from tickets where id = ${document.objectId} and (reporter_id = ${context.userId} or ${context.capabilities.has("ticket.read.all")}))`,
					),
					and(
						sql`${document.objectType} = 'knowledge_article'`,
						sql`${context.capabilities.has("knowledge.read")}`,
					),
					and(
						sql`${document.objectType} not in ('ticket', 'knowledge_article')`,
						sql`${context.capabilities.has("ticket.read.all")}`,
					),
				)!,
		),
	),
};
