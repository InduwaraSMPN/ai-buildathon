import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	assetCheckoutLog,
	assetDevices,
	assetHistory,
	assetImportRejections,
	assetImportRuns,
	assetStatuses,
	assets,
	authProviders,
	channelMessages,
	changes,
	contracts,
	dashboardWidgets,
	documentLinks,
	documents,
	emailSendLog,
	emailTemplateRules,
	emailTemplates,
	messagingChannels,
	messagingThreads,
	recurringTickets,
	serviceImpactLevels,
	softwareInventoryApps,
	softwareLicenceAllocations,
	softwareLicenceEntitlements,
	softwareProducts,
	statusIncidents,
	statusServices,
	suppliers,
	ticketAudit,
	ticketMessages,
	ticketNumberCounters,
	ticketNumberHistory,
	ticketRuleFirings,
	ticketRules,
	ticketScheduling,
	tickets,
	user,
} from "@/db/schema";
import { derivePriority } from "@/shared";
import { importAssetsCsv, previewAssetImport } from "../assets/import";
import { planThreadIngestion } from "../channel-ingestion";
import { dashboardArrangementRows } from "../dashboards";
import { fetchDirectoryPeople } from "../directory/http-source";
import { DatabaseDirectorySyncStore } from "../directory/store";
import { syncDirectory } from "../directory/sync";
import { prepareLinkDocument } from "../documents";
import {
	listVisibleDocuments,
	requireDocumentWriteTarget,
} from "../documents/http";
import {
	readDynamicFieldValues,
	writeDynamicFieldValues,
} from "../dynamic-fields";
import { capabilityProcedure, publicProcedure } from "../orpc";
import { evaluateTicketRules } from "../rules";
import { endFromDuration } from "../scheduling";
import { generateDueRecurrences } from "../scheduling-runtime";
import { indexTicket } from "../search/projections";
import { attachTicketStopwatches } from "../sla/runtime";
import { assessSoftwareCompliance } from "../software-compliance";
import { dailyAvailability, uptimeWindows } from "../status";
import { formatTicketNumber } from "../ticket-records";

const requireTicketAccess = async (
	ticketId: string,
	userId: string,
	canReadAll: boolean,
) => {
	const [ticket] = await db
		.select({
			id: tickets.id,
			ticketNumber: tickets.number,
			title: tickets.title,
			status: tickets.status,
			priority: tickets.priority,
		})
		.from(tickets)
		.where(
			and(
				eq(tickets.id, ticketId),
				canReadAll ? undefined : eq(tickets.reporterId, userId),
			),
		)
		.limit(1);
	if (!ticket) throw new ORPCError("NOT_FOUND");
	return ticket;
};

export const tier4Router = {
	readStatus: publicProcedure.readStatus.handler(async ({ input }) => {
		const end = new Date();
		const start = new Date(end.getTime() - input.days * 86_400_000);
		const [services, impacts, incidents, plannedChanges] = await Promise.all([
			db
				.select()
				.from(statusServices)
				.where(eq(statusServices.active, true))
				.orderBy(asc(statusServices.name)),
			db.select().from(serviceImpactLevels),
			db
				.select()
				.from(statusIncidents)
				.where(
					and(
						lte(statusIncidents.startedAt, end),
						or(
							sql`${statusIncidents.resolvedAt} is null`,
							gte(statusIncidents.resolvedAt, start),
						),
					),
				),
			db
				.select({
					startsAt: changes.outageStartAt,
					endsAt: changes.outageEndAt,
				})
				.from(changes)
				.where(
					and(
						inArray(changes.status, [
							"approved",
							"scheduled",
							"in_progress",
							"completed",
						]),
						lte(changes.outageStartAt, end),
						gte(changes.outageEndAt, start),
					),
				),
		]);
		const changeWindows = plannedChanges.filter(
			(window): window is { startsAt: Date; endsAt: Date } =>
				Boolean(window.startsAt && window.endsAt),
		);
		const impactConfig = Object.fromEntries(
			impacts.map((impact) => [impact.key, impact.countsAsDowntime]),
		);
		return services.map((service) => {
			const serviceIncidents = incidents.filter(
				(incident) => incident.serviceId === service.id,
			);
			return {
				id: service.id,
				name: service.name,
				days: dailyAvailability(
					serviceIncidents,
					impactConfig,
					end,
					input.days,
					true,
					changeWindows,
				),
				uptime: uptimeWindows(
					serviceIncidents,
					impactConfig,
					end,
					true,
					changeWindows,
				),
			};
		});
	}),
	upsertStatusService: capabilityProcedure(
		"admin.settings",
	).upsertStatusService.handler(async ({ input }) => {
		const [row] = await db
			.insert(statusServices)
			.values(input)
			.onConflictDoUpdate({ target: statusServices.id, set: input })
			.returning({ id: statusServices.id });
		return row!;
	}),
	upsertImpactLevel: capabilityProcedure(
		"admin.settings",
	).upsertImpactLevel.handler(async ({ input }) => {
		const [row] = await db
			.insert(serviceImpactLevels)
			.values(input)
			.onConflictDoUpdate({ target: serviceImpactLevels.key, set: input })
			.returning({ key: serviceImpactLevels.key });
		return row!;
	}),
	createStatusIncident: capabilityProcedure(
		"admin.settings",
	).createStatusIncident.handler(async ({ input }) => {
		if (input.resolvedAt && input.resolvedAt < input.startedAt)
			throw new ORPCError("BAD_REQUEST", {
				message: "Resolution cannot precede start",
			});
		const [row] = await db
			.insert(statusIncidents)
			.values({ id: crypto.randomUUID(), ...input })
			.returning({ id: statusIncidents.id });
		return row!;
	}),
	updateStatusIncident: capabilityProcedure(
		"admin.settings",
	).updateStatusIncident.handler(async ({ input: { id, ...input } }) => {
		const [current] = await db
			.select()
			.from(statusIncidents)
			.where(eq(statusIncidents.id, id))
			.limit(1);
		if (!current) throw new ORPCError("NOT_FOUND");
		if (
			(input.resolvedAt ?? current.resolvedAt) &&
			(input.resolvedAt ?? current.resolvedAt)! <
				(input.startedAt ?? current.startedAt)
		)
			throw new ORPCError("BAD_REQUEST", {
				message: "Resolution cannot precede start",
			});
		const [row] = await db
			.update(statusIncidents)
			.set(input)
			.where(eq(statusIncidents.id, id))
			.returning({ id: statusIncidents.id });
		return row!;
	}),
	listAssets: capabilityProcedure("admin.settings").listAssets.handler(
		async () =>
			Promise.all(
				(
					await db
						.select({
							id: assets.id,
							name: assets.name,
							assetTag: assets.assetTag,
							status: assetStatuses.name,
							owner: user.name,
						})
						.from(assets)
						.leftJoin(assetStatuses, eq(assets.statusId, assetStatuses.id))
						.leftJoin(user, eq(assets.custodianId, user.id))
						.orderBy(asc(assets.name))
				).map(async (asset) => ({
					...asset,
					customFields: await readDynamicFieldValues(db, "asset", asset.id),
				})),
			),
	),
	previewAssetImport: capabilityProcedure(
		"admin.settings",
	).previewAssetImport.handler(({ input }) => previewAssetImport(input)),
	importAssets: capabilityProcedure("admin.settings").importAssets.handler(
		({ input }) => importAssetsCsv(input),
	),
	listAssetImportRuns: capabilityProcedure(
		"admin.settings",
	).listAssetImportRuns.handler(() =>
		db
			.select()
			.from(assetImportRuns)
			.orderBy(desc(assetImportRuns.createdAt))
			.limit(50),
	),
	listAssetImportRejections: capabilityProcedure(
		"admin.settings",
	).listAssetImportRejections.handler(({ input }) =>
		db
			.select()
			.from(assetImportRejections)
			.where(eq(assetImportRejections.runId, input.runId))
			.orderBy(asc(assetImportRejections.rowNumber)),
	),
	listAssetHistory: capabilityProcedure(
		"admin.settings",
	).listAssetHistory.handler(({ input }) =>
		db
			.select()
			.from(assetHistory)
			.where(eq(assetHistory.assetId, input.assetId))
			.orderBy(desc(assetHistory.createdAt)),
	),
	setAssetDynamicFields: capabilityProcedure(
		"admin.settings",
	).setAssetDynamicFields.handler(async ({ input }) => {
		if (
			!(
				await db
					.select({ id: assets.id })
					.from(assets)
					.where(eq(assets.id, input.assetId))
					.limit(1)
			)[0]
		)
			throw new ORPCError("NOT_FOUND");
		return writeDynamicFieldValues(db, "asset", input.assetId, input.values);
	}),
	ingestChannelMessage: capabilityProcedure(
		"ticket.create",
	).ingestChannelMessage.handler(async ({ context, input }) => {
		const planned = planThreadIngestion(input, null);
		const result = await db.transaction(async (tx) => {
			const [channel] = await tx
				.insert(messagingChannels)
				.values({
					id: crypto.randomUUID(),
					key: planned.ruleFacts.channelKey,
					name: input.channelKey.trim(),
					kind: input.channelKind,
				})
				.onConflictDoUpdate({
					target: messagingChannels.key,
					set: { name: input.channelKey.trim() },
				})
				.returning();
			if (!channel || channel.kind !== input.channelKind)
				throw new ORPCError("CONFLICT", {
					message: "Channel kind does not match existing channel",
				});
			let [thread] = await tx
				.select()
				.from(messagingThreads)
				.where(
					and(
						eq(messagingThreads.channelId, channel.id),
						eq(
							messagingThreads.externalThreadId,
							input.externalThreadId.trim(),
						),
					),
				)
				.limit(1);
			if (!thread)
				[thread] = await tx
					.insert(messagingThreads)
					.values({
						id: crypto.randomUUID(),
						channelId: channel.id,
						externalThreadId: input.externalThreadId.trim(),
						originKey: planned.originKey,
						participantRef: input.senderRef?.trim(),
						openedAt: input.receivedAt,
						lastMessageAt: input.receivedAt,
					})
					.returning();
			if (!thread) throw new ORPCError("INTERNAL_SERVER_ERROR");
			const [message] = await tx
				.insert(channelMessages)
				.values({
					id: crypto.randomUUID(),
					threadId: thread.id,
					externalMessageId: input.externalMessageId.trim(),
					direction: "inbound",
					senderRef: input.senderRef?.trim(),
					body: input.body.trim(),
					raw: input.raw,
					receivedAt: input.receivedAt,
				})
				.onConflictDoNothing()
				.returning();
			if (!message) {
				const [existing] = await tx
					.select({ id: channelMessages.id })
					.from(channelMessages)
					.where(
						and(
							eq(channelMessages.threadId, thread.id),
							eq(
								channelMessages.externalMessageId,
								input.externalMessageId.trim(),
							),
						),
					);
				if (!thread.ticketId || !existing) throw new ORPCError("CONFLICT");
				return {
					duplicate: true,
					ticketId: thread.ticketId,
					threadId: thread.id,
					messageId: existing.id,
					created: false,
				};
			}
			if (thread.ticketId) {
				await tx.insert(ticketMessages).values({
					id: crypto.randomUUID(),
					ticketId: thread.ticketId,
					authorId: context.userId,
					authorType: "reporter",
					body: input.body.trim(),
					visibility: "public",
				});
				await tx
					.update(messagingThreads)
					.set({ lastMessageAt: input.receivedAt })
					.where(eq(messagingThreads.id, thread.id));
				return {
					duplicate: false,
					ticketId: thread.ticketId,
					threadId: thread.id,
					messageId: message.id,
					created: false,
				};
			}
			const title =
				input.title ?? input.body.trim().split(/\r?\n/, 1)[0]!.slice(0, 160);
			const evaluation = evaluateTicketRules(
				{
					title,
					body: input.body.trim(),
					requesterId: context.userId,
					origin: thread.originKey,
					recordType: "incident",
					impact: "medium",
					urgency: "medium",
				},
				await tx
					.select()
					.from(ticketRules)
					.where(eq(ticketRules.enabled, true)),
			);
			const ticketId = crypto.randomUUID();
			const year = String(input.receivedAt.getUTCFullYear());
			const counter = (
				await tx
					.insert(ticketNumberCounters)
					.values({ prefix: "INC", year, lastValue: 1 })
					.onConflictDoUpdate({
						target: [ticketNumberCounters.prefix, ticketNumberCounters.year],
						set: { lastValue: sql`${ticketNumberCounters.lastValue} + 1` },
					})
					.returning({ value: ticketNumberCounters.lastValue })
			)[0]!;
			const number = formatTicketNumber(
				"incident",
				Number(year),
				counter.value,
			);
			await tx.insert(tickets).values({
				id: ticketId,
				number,
				reporterId: context.userId,
				title,
				body: input.body.trim(),
				recordType: evaluation.ticket.recordType,
				impact: evaluation.ticket.impact,
				urgency: evaluation.ticket.urgency,
				priority: derivePriority(
					evaluation.ticket.impact,
					evaluation.ticket.urgency,
				),
				category: evaluation.ticket.category,
				route: evaluation.ticket.route,
				teamId: evaluation.ticket.teamId,
				assigneeId: evaluation.ticket.assigneeId,
			});
			await tx.insert(ticketNumberHistory).values({ number, ticketId });
			if (evaluation.firings.length) {
				await tx.insert(ticketRuleFirings).values(
					evaluation.firings.map((firing) => ({
						id: crypto.randomUUID(),
						ticketId,
						ruleId: firing.ruleId,
						rulePosition: firing.rulePosition,
						result: firing,
					})),
				);
				await tx.insert(ticketAudit).values(
					evaluation.firings.flatMap((firing) =>
						firing.applied.map((action) => ({
							id: crypto.randomUUID(),
							ticketId,
							fieldName: action.type,
							oldValue: null,
							newValue: "value" in action ? action.value : true,
							actorId: `rule:${firing.ruleId}`,
						})),
					),
				);
			}
			await tx
				.update(messagingThreads)
				.set({ ticketId, lastMessageAt: input.receivedAt })
				.where(eq(messagingThreads.id, thread.id));
			return {
				duplicate: false,
				ticketId,
				threadId: thread.id,
				messageId: message.id,
				created: true,
			};
		});
		if (result.created) {
			await attachTicketStopwatches(result.ticketId, "P3");
			await indexTicket(db, result.ticketId);
		}
		return {
			accepted: true as const,
			duplicate: result.duplicate,
			ticketId: result.ticketId,
			threadId: result.threadId,
			messageId: result.messageId,
		};
	}),
	checkoutAsset: capabilityProcedure("admin.settings").checkoutAsset.handler(
		async ({ context, input }) => {
			const now = new Date();
			return db.transaction(async (tx) => {
				const [asset] = await tx
					.update(assets)
					.set({ custodianId: input.custodianId, updatedAt: now })
					.where(eq(assets.id, input.assetId))
					.returning({ id: assets.id });
				if (!asset) throw new ORPCError("NOT_FOUND");
				await tx
					.update(assetCheckoutLog)
					.set({ checkedInAt: now })
					.where(
						and(
							eq(assetCheckoutLog.assetId, input.assetId),
							sql`${assetCheckoutLog.checkedInAt} is null`,
						),
					);
				await tx.insert(assetCheckoutLog).values({
					id: crypto.randomUUID(),
					assetId: input.assetId,
					custodianId: input.custodianId,
					checkedOutAt: now,
					note: input.note,
				});
				const [history] = await tx
					.insert(assetHistory)
					.values({
						id: crypto.randomUUID(),
						assetId: input.assetId,
						action: "checkout",
						actorId: context.userId,
						changes: {
							custodianId: input.custodianId,
							note: input.note ?? null,
						},
					})
					.returning();
				return history!;
			});
		},
	),
	checkinAsset: capabilityProcedure("admin.settings").checkinAsset.handler(
		async ({ context, input }) => {
			const now = new Date();
			return db.transaction(async (tx) => {
				const [asset] = await tx
					.update(assets)
					.set({ custodianId: null, updatedAt: now })
					.where(eq(assets.id, input.assetId))
					.returning({ id: assets.id });
				if (!asset) throw new ORPCError("NOT_FOUND");
				await tx
					.update(assetCheckoutLog)
					.set({ checkedInAt: now })
					.where(
						and(
							eq(assetCheckoutLog.assetId, input.assetId),
							sql`${assetCheckoutLog.checkedInAt} is null`,
						),
					);
				const [history] = await tx
					.insert(assetHistory)
					.values({
						id: crypto.randomUUID(),
						assetId: input.assetId,
						action: "checkin",
						actorId: context.userId,
						changes: { note: input.note ?? null },
					})
					.returning();
				return history!;
			});
		},
	),
	listSoftwareEntitlements: capabilityProcedure(
		"admin.settings",
	).listSoftwareEntitlements.handler(async () => {
		const rows = await db
			.select({
				id: softwareLicenceEntitlements.id,
				productId: softwareLicenceEntitlements.productId,
				productName: softwareProducts.name,
				publisher: softwareProducts.publisher,
				licenceKey: softwareLicenceEntitlements.licenceKey,
				seatCount: softwareLicenceEntitlements.seatCount,
				validFrom: softwareLicenceEntitlements.validFrom,
				expiresAt: softwareLicenceEntitlements.expiresAt,
			})
			.from(softwareLicenceEntitlements)
			.innerJoin(
				softwareProducts,
				eq(softwareLicenceEntitlements.productId, softwareProducts.id),
			)
			.orderBy(asc(softwareProducts.name));
		const allocations = await db
			.select()
			.from(softwareLicenceAllocations)
			.where(sql`${softwareLicenceAllocations.revokedAt} is null`);
		return rows.map((row) => ({
			...row,
			allocatedSeats: allocations.filter(
				(item) => item.entitlementId === row.id,
			).length,
		}));
	}),
	createSoftwareEntitlement: capabilityProcedure(
		"admin.settings",
	).createSoftwareEntitlement.handler(async ({ input }) => {
		if (input.validFrom && input.expiresAt && input.expiresAt < input.validFrom)
			throw new ORPCError("BAD_REQUEST", {
				message: "Expiry must follow validity start",
			});
		const productId = crypto.randomUUID();
		const entitlementId = crypto.randomUUID();
		await db.transaction(async (tx) => {
			await tx
				.insert(softwareProducts)
				.values({
					id: productId,
					name: input.productName,
					publisher: input.publisher,
					identityKey: input.identityKey,
				})
				.onConflictDoUpdate({
					target: softwareProducts.identityKey,
					set: { name: input.productName, publisher: input.publisher },
				});
			const [product] = await tx
				.select({ id: softwareProducts.id })
				.from(softwareProducts)
				.where(eq(softwareProducts.identityKey, input.identityKey))
				.limit(1);
			await tx.insert(softwareLicenceEntitlements).values({
				id: entitlementId,
				productId: product!.id,
				licenceKey: input.licenceKey,
				seatCount: input.seatCount,
				validFrom: input.validFrom,
				expiresAt: input.expiresAt,
			});
		});
		const [row] = await db
			.select({
				id: softwareLicenceEntitlements.id,
				productId: softwareLicenceEntitlements.productId,
				productName: softwareProducts.name,
				publisher: softwareProducts.publisher,
				licenceKey: softwareLicenceEntitlements.licenceKey,
				seatCount: softwareLicenceEntitlements.seatCount,
				validFrom: softwareLicenceEntitlements.validFrom,
				expiresAt: softwareLicenceEntitlements.expiresAt,
			})
			.from(softwareLicenceEntitlements)
			.innerJoin(
				softwareProducts,
				eq(softwareLicenceEntitlements.productId, softwareProducts.id),
			)
			.where(eq(softwareLicenceEntitlements.id, entitlementId));
		return { ...row!, allocatedSeats: 0 };
	}),
	allocateSoftwareLicence: capabilityProcedure(
		"admin.settings",
	).allocateSoftwareLicence.handler(async ({ input }) => {
		const id = crypto.randomUUID();
		await db.insert(softwareLicenceAllocations).values({ id, ...input });
		return { id };
	}),
	revokeSoftwareAllocation: capabilityProcedure(
		"admin.settings",
	).revokeSoftwareAllocation.handler(async ({ input }) => ({
		revoked: Boolean(
			(
				await db
					.update(softwareLicenceAllocations)
					.set({ revokedAt: new Date() })
					.where(
						and(
							eq(softwareLicenceAllocations.id, input.id),
							sql`${softwareLicenceAllocations.revokedAt} is null`,
						),
					)
					.returning({ id: softwareLicenceAllocations.id })
			)[0],
		),
	})),
	readSoftwareCompliance: capabilityProcedure(
		"admin.settings",
	).readSoftwareCompliance.handler(async () => {
		const [products, entitlements, allocations, inventory] = await Promise.all([
			db.select().from(softwareProducts),
			db.select().from(softwareLicenceEntitlements),
			db.select().from(softwareLicenceAllocations),
			db
				.select({
					app: softwareInventoryApps,
					assetId: assetDevices.assetId,
					assetName: assets.name,
				})
				.from(softwareInventoryApps)
				.innerJoin(
					assetDevices,
					eq(softwareInventoryApps.assetDeviceId, assetDevices.id),
				)
				.innerJoin(assets, eq(assetDevices.assetId, assets.id)),
		]);
		const productsByIdentity = new Map(
			products.map((item) => [item.identityKey, item]),
		);
		const installs = inventory.flatMap(({ app, assetId }) => {
			const product = productsByIdentity.get(app.identityKey);
			return product ? [{ productId: product.id, assetId }] : [];
		});
		const assessed = assessSoftwareCompliance(
			installs,
			entitlements,
			allocations,
		);
		const names = new Map(products.map((item) => [item.id, item.name]));
		const assetsById = new Map(
			inventory.map((item) => [item.assetId, item.assetName]),
		);
		const results = assessed.installResults.map((item) => ({
			...item,
			productName: names.get(item.productId)!,
			assetName: assetsById.get(item.assetId)!,
		}));
		return {
			summary: {
				compliant: results.filter((item) => item.status === "compliant").length,
				unlicensed: results.filter((item) => item.status === "unlicensed")
					.length,
				expired: results.filter((item) => item.status === "expired").length,
				overAllocated: results.filter(
					(item) => item.status === "over-allocated",
				).length,
			},
			installs: results,
		};
	}),
	setTicketSchedule: capabilityProcedure(
		"ticket.reclassify",
	).setTicketSchedule.handler(async ({ context, input }) => {
		const ticket = await requireTicketAccess(
			input.ticketId,
			context.userId,
			context.capabilities.has("ticket.read.all"),
		);
		const [row] = await db
			.insert(ticketScheduling)
			.values({
				ticketId: input.ticketId,
				workStartAt: input.workStartAt,
				workEndAt: input.workStartAt
					? endFromDuration(input.workStartAt, input.durationMinutes)
					: null,
				workAllDay: input.workAllDay,
			})
			.onConflictDoUpdate({
				target: ticketScheduling.ticketId,
				set: {
					workStartAt: input.workStartAt,
					workEndAt: input.workStartAt
						? endFromDuration(input.workStartAt, input.durationMinutes)
						: null,
					workAllDay: input.workAllDay,
					updatedAt: new Date(),
				},
			})
			.returning();
		if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return { ...row, ...ticket };
	}),
	snoozeTicket: capabilityProcedure("ticket.reclassify").snoozeTicket.handler(
		async ({ context, input }) => {
			const ticket = await requireTicketAccess(
				input.ticketId,
				context.userId,
				context.capabilities.has("ticket.read.all"),
			);
			const [row] = await db
				.insert(ticketScheduling)
				.values({ ticketId: input.ticketId, snoozedUntil: input.until })
				.onConflictDoUpdate({
					target: ticketScheduling.ticketId,
					set: { snoozedUntil: input.until, updatedAt: new Date() },
				})
				.returning();
			if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
			return { ...row, ...ticket };
		},
	),
	listCalendar: capabilityProcedure("ticket.read.own").listCalendar.handler(
		async ({ context, input }) => {
			if (input.to < input.from)
				throw new ORPCError("BAD_REQUEST", {
					message: "Calendar end must follow start",
				});
			return db
				.select({
					ticketId: ticketScheduling.ticketId,
					ticketNumber: tickets.number,
					title: tickets.title,
					status: tickets.status,
					priority: tickets.priority,
					workStartAt: ticketScheduling.workStartAt,
					workEndAt: ticketScheduling.workEndAt,
					workAllDay: ticketScheduling.workAllDay,
					snoozedUntil: ticketScheduling.snoozedUntil,
					updatedAt: ticketScheduling.updatedAt,
				})
				.from(ticketScheduling)
				.innerJoin(tickets, eq(ticketScheduling.ticketId, tickets.id))
				.where(
					and(
						context.capabilities.has("ticket.read.all")
							? undefined
							: eq(tickets.reporterId, context.userId),
						lte(ticketScheduling.workStartAt, input.to),
						gte(ticketScheduling.workEndAt, input.from),
					),
				)
				.orderBy(ticketScheduling.workStartAt);
		},
	),
	listRecurrences: capabilityProcedure(
		"admin.settings",
	).listRecurrences.handler(() =>
		db.select().from(recurringTickets).orderBy(asc(recurringTickets.startsAt)),
	),
	createRecurrence: capabilityProcedure(
		"admin.settings",
	).createRecurrence.handler(async ({ input }) => {
		const [row] = await db
			.insert(recurringTickets)
			.values({ id: crypto.randomUUID(), ...input })
			.returning();
		return row!;
	}),
	updateRecurrence: capabilityProcedure(
		"admin.settings",
	).updateRecurrence.handler(async ({ input: { id, ...input } }) => {
		const [row] = await db
			.update(recurringTickets)
			.set({ ...input, updatedAt: new Date() })
			.where(eq(recurringTickets.id, id))
			.returning();
		if (!row) throw new ORPCError("NOT_FOUND");
		return row;
	}),
	deleteRecurrence: capabilityProcedure(
		"admin.settings",
	).deleteRecurrence.handler(async ({ input }) => ({
		deleted: Boolean(
			(
				await db
					.delete(recurringTickets)
					.where(eq(recurringTickets.id, input.id))
					.returning({ id: recurringTickets.id })
			)[0],
		),
	})),
	triggerRecurrences: capabilityProcedure(
		"admin.settings",
	).triggerRecurrences.handler(({ input }) =>
		generateDueRecurrences(input.now, input.limit),
	),
	getDashboardArrangement: capabilityProcedure(
		"stats.read",
	).getDashboardArrangement.handler(async ({ context }) =>
		(
			await db
				.select({
					widgetKey: dashboardWidgets.widgetKey,
					position: dashboardWidgets.position,
					width: dashboardWidgets.width,
					settings: dashboardWidgets.settings,
				})
				.from(dashboardWidgets)
				.where(eq(dashboardWidgets.userId, context.userId))
				.orderBy(dashboardWidgets.position)
		).map((row) => ({
			...row,
			width: row.width === 2 ? (2 as const) : (1 as const),
		})),
	),
	setDashboardArrangement: capabilityProcedure(
		"stats.read",
	).setDashboardArrangement.handler(async ({ context, input }) => {
		const rows = dashboardArrangementRows(context.userId, input.widgets, () =>
			crypto.randomUUID(),
		);
		await db.transaction(async (tx) => {
			await tx
				.delete(dashboardWidgets)
				.where(eq(dashboardWidgets.userId, context.userId));
			if (rows.length) await tx.insert(dashboardWidgets).values(rows);
		});
		return rows.map(({ widgetKey, position, width, settings }) => ({
			widgetKey,
			position,
			width,
			settings,
		}));
	}),
	listAuthProviders: publicProcedure.listAuthProviders.handler(() =>
		db
			.select({
				providerId: authProviders.providerId,
				name: authProviders.name,
			})
			.from(authProviders)
			.where(eq(authProviders.enabled, true))
			.orderBy(authProviders.name),
	),
	listEmailTemplates: capabilityProcedure(
		"admin.settings",
	).listEmailTemplates.handler(() =>
		db
			.select({
				id: emailTemplates.id,
				name: emailTemplates.name,
				subject: emailTemplates.subject,
				textBody: emailTemplates.textBody,
				htmlBody: emailTemplates.htmlBody,
				enabled: emailTemplates.enabled,
			})
			.from(emailTemplates)
			.orderBy(asc(emailTemplates.name)),
	),
	createEmailTemplate: capabilityProcedure(
		"admin.settings",
	).createEmailTemplate.handler(async ({ input }) => {
		const [row] = await db
			.insert(emailTemplates)
			.values({ id: crypto.randomUUID(), ...input })
			.returning();
		if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return row;
	}),
	updateEmailTemplate: capabilityProcedure(
		"admin.settings",
	).updateEmailTemplate.handler(async ({ input: { id, ...input } }) => {
		const [row] = await db
			.update(emailTemplates)
			.set(input)
			.where(eq(emailTemplates.id, id))
			.returning();
		if (!row) throw new ORPCError("NOT_FOUND");
		return row;
	}),
	deleteEmailTemplate: capabilityProcedure(
		"admin.settings",
	).deleteEmailTemplate.handler(async ({ input }) => ({
		deleted: Boolean(
			(
				await db
					.delete(emailTemplates)
					.where(eq(emailTemplates.id, input.id))
					.returning({ id: emailTemplates.id })
			)[0],
		),
	})),
	listEmailTemplateRules: capabilityProcedure(
		"admin.settings",
	).listEmailTemplateRules.handler(() =>
		db
			.select()
			.from(emailTemplateRules)
			.orderBy(asc(emailTemplateRules.createdAt)),
	),
	setEmailTemplateRule: capabilityProcedure(
		"admin.settings",
	).setEmailTemplateRule.handler(async ({ input }) => {
		const id = input.id ?? crypto.randomUUID();
		const { id: _id, ...values } = { ...input, id };
		const [row] = await db
			.insert(emailTemplateRules)
			.values({ id, ...values })
			.onConflictDoUpdate({ target: emailTemplateRules.id, set: values })
			.returning();
		if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return row;
	}),
	deleteEmailTemplateRule: capabilityProcedure(
		"admin.settings",
	).deleteEmailTemplateRule.handler(async ({ input }) => ({
		deleted: Boolean(
			(
				await db
					.delete(emailTemplateRules)
					.where(eq(emailTemplateRules.id, input.id))
					.returning({ id: emailTemplateRules.id })
			)[0],
		),
	})),
	previewDirectorySync: capabilityProcedure(
		"admin.settings",
	).previewDirectorySync.handler(async ({ input }) =>
		syncDirectory(
			new DatabaseDirectorySyncStore(input.providerId),
			await fetchDirectoryPeople(input.providerId),
			"preview",
		),
	),
	applyDirectorySync: capabilityProcedure(
		"admin.settings",
	).applyDirectorySync.handler(async ({ input }) =>
		syncDirectory(
			new DatabaseDirectorySyncStore(input.providerId),
			await fetchDirectoryPeople(input.providerId),
			"apply",
		),
	),
	listDocuments: capabilityProcedure("ticket.read.own").listDocuments.handler(
		async ({ context, input }) => {
			const rows = await listVisibleDocuments(input, {
				userId: context.userId,
				role: context.capabilities.has("ticket.read.all")
					? "analyst"
					: "reporter",
			});
			return rows.map(({ document: item }) =>
				item.kind === "link" && item.url
					? {
							id: item.id,
							kind: "link" as const,
							displayName: item.displayName,
							url: item.url,
						}
					: {
							id: item.id,
							kind: "file" as const,
							displayName: item.displayName,
							mediaType: item.mediaType,
							downloadUrl: `/api/documents/${item.id}`,
						},
			);
		},
	),
	createLinkDocument: capabilityProcedure(
		"ticket.update",
	).createLinkDocument.handler(async ({ context, input }) => {
		await requireDocumentWriteTarget(input, {
			userId: context.userId,
			role: context.capabilities.has("ticket.read.all")
				? "analyst"
				: "reporter",
		});
		const prepared = prepareLinkDocument(input.displayName, input.url);
		const id = crypto.randomUUID();
		await db.transaction(async (tx) => {
			await tx.insert(documents).values({ id, kind: "link", ...prepared });
			await tx.insert(documentLinks).values({
				id: crypto.randomUUID(),
				documentId: id,
				targetType: input.targetType,
				targetId: input.targetId,
			});
		});
		return { id, kind: "link" as const, ...prepared };
	}),
	unlinkDocument: capabilityProcedure("ticket.update").unlinkDocument.handler(
		async ({ context, input }) => {
			await requireDocumentWriteTarget(input, {
				userId: context.userId,
				role: context.capabilities.has("ticket.read.all")
					? "analyst"
					: "reporter",
			});
			const deleted = Boolean(
				(
					await db
						.delete(documentLinks)
						.where(
							and(
								eq(documentLinks.documentId, input.documentId),
								eq(documentLinks.targetType, input.targetType),
								eq(documentLinks.targetId, input.targetId),
							),
						)
						.returning({ id: documentLinks.id })
				)[0],
			);
			return { deleted };
		},
	),
	listSuppliers: capabilityProcedure("admin.settings").listSuppliers.handler(
		() =>
			db
				.select({
					id: suppliers.id,
					name: suppliers.name,
					contactName: suppliers.contactName,
					contactEmail: suppliers.contactEmail,
					active: suppliers.active,
				})
				.from(suppliers)
				.orderBy(asc(suppliers.name))
				.then((rows) =>
					rows.map(({ contactName, contactEmail, active, ...row }) => ({
						...row,
						contact: contactName ?? contactEmail,
						status: active ? ("active" as const) : ("inactive" as const),
					})),
				),
	),
	listContracts: capabilityProcedure("admin.settings").listContracts.handler(
		() =>
			db
				.select({
					id: contracts.id,
					name: contracts.name,
					supplierName: suppliers.name,
					startsOn: contracts.startsOn,
					endsOn: contracts.endsOn,
					active: contracts.active,
				})
				.from(contracts)
				.innerJoin(suppliers, eq(contracts.supplierId, suppliers.id))
				.orderBy(asc(contracts.name))
				.then((rows) =>
					rows.map(({ active, ...row }) => ({
						...row,
						status: active ? ("active" as const) : ("inactive" as const),
					})),
				),
	),
	listEmailSendLog: capabilityProcedure(
		"admin.settings",
	).listEmailSendLog.handler(({ input }) =>
		db
			.select()
			.from(emailSendLog)
			.where(
				input.ticketId ? eq(emailSendLog.ticketId, input.ticketId) : undefined,
			)
			.orderBy(desc(emailSendLog.attemptedAt))
			.limit(input.limit),
	),
};
