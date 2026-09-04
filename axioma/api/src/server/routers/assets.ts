import { ORPCError } from "@orpc/server";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	assetCheckoutLog,
	assetDevices,
	assetDisks,
	assetHardware,
	assetHistory,
	assetImportRejections,
	assetImportRuns,
	assetStatuses,
	assets,
	inventoryReports,
	softwareInventoryApps,
	softwareLicenceAllocations,
	softwareLicenceEntitlements,
	softwareProducts,
	user,
} from "@/db/schema";
import { importAssetsCsv, previewAssetImport } from "../assets/import";
import {
	readDynamicFieldValues,
	writeDynamicFieldValues,
} from "../dynamic-fields";
import { capabilityProcedure } from "../orpc";
import { assessSoftwareCompliance } from "../software-compliance";

export const assetsRouter = {
	readDeviceInventory: capabilityProcedure(
		"device.read",
	).readDeviceInventory.handler(async ({ input }) => {
		// Every inventory table keys off assetDevices.id, not the asset it points
		// at; the two only coincide for links ingestInventoryReport created.
		const [link] = await db
			.select({
				id: assetDevices.id,
				deviceId: assetDevices.deviceId,
				assetId: assetDevices.assetId,
				lastReportedAt: assetDevices.lastReportedAt,
			})
			.from(assetDevices)
			.where(eq(assetDevices.deviceId, input.deviceId))
			.limit(1);
		if (!link) throw new ORPCError("NOT_FOUND");
		const [report] = await db
			.select({ reportedAt: inventoryReports.reportedAt })
			.from(inventoryReports)
			.where(eq(inventoryReports.assetDeviceId, link.id))
			.orderBy(desc(inventoryReports.reportedAt))
			.limit(1);
		const [hardware] = await db
			.select({
				manufacturer: assetHardware.manufacturer,
				model: assetHardware.model,
				serialNumber: assetHardware.serialNumber,
				cpu: assetHardware.cpu,
				memoryBytes: assetHardware.memoryBytes,
				biosVersion: assetHardware.biosVersion,
				observedAt: assetHardware.observedAt,
			})
			.from(assetHardware)
			.where(eq(assetHardware.assetDeviceId, link.id))
			.orderBy(desc(assetHardware.observedAt))
			.limit(1);
		const [disks, software] = await Promise.all([
			db
				.select({
					deviceKey: assetDisks.deviceKey,
					model: assetDisks.model,
					serialNumber: assetDisks.serialNumber,
					sizeBytes: assetDisks.sizeBytes,
					observedAt: assetDisks.observedAt,
				})
				.from(assetDisks)
				.where(eq(assetDisks.assetDeviceId, link.id))
				.orderBy(asc(assetDisks.deviceKey)),
			db
				.select({
					name: softwareInventoryApps.name,
					version: softwareInventoryApps.version,
					publisher: softwareInventoryApps.publisher,
					installDate: softwareInventoryApps.installDate,
					observedAt: softwareInventoryApps.observedAt,
				})
				.from(softwareInventoryApps)
				.where(eq(softwareInventoryApps.assetDeviceId, link.id))
				.orderBy(asc(softwareInventoryApps.name)),
		]);
		return {
			deviceId: link.deviceId,
			assetId: link.assetId,
			reportedAt: report?.reportedAt ?? link.lastReportedAt ?? null,
			disks,
			hardware: hardware ?? null,
			software,
		};
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
				if (!history) throw new Error("Asset checkout history insert failed");
				return history;
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
				if (!history) throw new Error("Asset check-in history insert failed");
				return history;
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
			if (!product) throw new Error("Software product upsert failed");
			await tx.insert(softwareLicenceEntitlements).values({
				id: entitlementId,
				productId: product.id,
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
		if (!row) throw new Error("Software entitlement insert failed");
		return { ...row, allocatedSeats: 0 };
	}),
	allocateSoftwareLicence: capabilityProcedure(
		"admin.settings",
	).allocateSoftwareLicence.handler(async ({ input }) => {
		const id = crypto.randomUUID();
		// The entitlement is locked, counted and compared before the insert.
		// Without it an unknown id surfaced as a raw foreign-key 500 rather than a
		// 404, and an entitlement for five seats accepted five hundred
		// allocations — over-allocation was only ever *reported* afterwards by the
		// compliance view, never prevented.
		await db.transaction(async (tx) => {
			const [entitlement] = await tx
				.select({ seatCount: softwareLicenceEntitlements.seatCount })
				.from(softwareLicenceEntitlements)
				.where(eq(softwareLicenceEntitlements.id, input.entitlementId))
				.limit(1)
				.for("update");
			if (!entitlement)
				throw new ORPCError("NOT_FOUND", {
					message: "Licence entitlement not found",
				});
			const [allocated] = await tx
				.select({ used: count() })
				.from(softwareLicenceAllocations)
				.where(
					and(
						eq(softwareLicenceAllocations.entitlementId, input.entitlementId),
						sql`${softwareLicenceAllocations.revokedAt} is null`,
					),
				);
			if ((allocated?.used ?? 0) >= entitlement.seatCount)
				throw new ORPCError("CONFLICT", {
					message: `All ${entitlement.seatCount} seats on this entitlement are allocated`,
				});
			await tx.insert(softwareLicenceAllocations).values({ id, ...input });
		});
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
		const results = assessed.installResults.map((item) => {
			const productName = names.get(item.productId);
			const assetName = assetsById.get(item.assetId);
			if (productName === undefined || assetName === undefined)
				throw new Error("Software compliance result references missing data");
			return { ...item, productName, assetName };
		});
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
};
