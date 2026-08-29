import { oc } from "@orpc/contract";
import { z } from "zod";

const licenceEntitlement = z.object({
	id: z.string(),
	productId: z.string(),
	productName: z.string(),
	publisher: z.string().nullable(),
	licenceKey: z.string().nullable(),
	seatCount: z.number().int().positive(),
	validFrom: z.date().nullable(),
	expiresAt: z.date().nullable(),
	allocatedSeats: z.number().int().nonnegative(),
});

const assetHistoryEntry = z.object({
	id: z.string(),
	assetId: z.string(),
	action: z.string(),
	actorId: z.string().nullable(),
	changes: z.unknown(),
	createdAt: z.date(),
});

const importRejection = z.object({
	id: z.string(),
	runId: z.string(),
	rowNumber: z.number().int(),
	reason: z.string(),
	row: z.unknown(),
});

const importRun = z.object({
	id: z.string(),
	profileId: z.string().nullable(),
	fileName: z.string().nullable(),
	totalRows: z.number().int(),
	acceptedRows: z.number().int(),
	rejectedRows: z.number().int(),
	createdAt: z.date(),
});

const csvRow = z.record(z.string(), z.string());

const assetPreview = z.object({
	headers: z.array(z.string()),
	accepted: z.array(
		z.object({
			rowNumber: z.number().int(),
			identityKey: z.string(),
			values: csvRow,
		}),
	),
	rejected: z.array(
		z.object({ rowNumber: z.number().int(), reason: z.string(), row: csvRow }),
	),
});

const assetImportInput = z.object({
	profileId: z.string().trim().min(1),
	identityColumns: z.array(z.string().trim().min(1)).min(1).max(10),
	csv: z.string().min(1),
	fileName: z.string().trim().max(255).optional(),
});

export const assetsContract = {
	listAssets: oc.output(
		z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				assetTag: z.string().nullable(),
				status: z.string().nullable(),
				owner: z.string().nullable(),
				customFields: z.record(z.string(), z.unknown()),
			}),
		),
	),
	previewAssetImport: oc.input(assetImportInput).output(assetPreview),
	importAssets: oc.input(assetImportInput).output(
		z.object({
			runId: z.string(),
			inserted: z.number().int(),
			updated: z.number().int(),
			rejected: z.number().int(),
		}),
	),
	listAssetImportRuns: oc.output(z.array(importRun)),
	listAssetImportRejections: oc
		.input(z.object({ runId: z.string().min(1) }))
		.output(z.array(importRejection)),
	listAssetHistory: oc
		.input(z.object({ assetId: z.string().min(1) }))
		.output(z.array(assetHistoryEntry)),
	setAssetDynamicFields: oc
		.input(
			z.object({
				assetId: z.string().min(1),
				values: z.record(z.string(), z.unknown()),
			}),
		)
		.output(z.record(z.string(), z.unknown())),
	checkoutAsset: oc
		.input(
			z.object({
				assetId: z.string().min(1),
				custodianId: z.string().min(1),
				note: z.string().trim().max(2_000).optional(),
			}),
		)
		.output(assetHistoryEntry),
	checkinAsset: oc
		.input(
			z.object({
				assetId: z.string().min(1),
				note: z.string().trim().max(2_000).optional(),
			}),
		)
		.output(assetHistoryEntry),
	listSoftwareEntitlements: oc.output(z.array(licenceEntitlement)),
	createSoftwareEntitlement: oc
		.input(
			z.object({
				productName: z.string().trim().min(1).max(255),
				publisher: z.string().trim().max(255).optional(),
				identityKey: z.string().trim().min(1).max(255),
				licenceKey: z.string().trim().max(1_000).optional(),
				seatCount: z.number().int().positive(),
				validFrom: z.coerce.date().optional(),
				expiresAt: z.coerce.date().optional(),
			}),
		)
		.output(licenceEntitlement),
	allocateSoftwareLicence: oc
		.input(
			z
				.object({
					entitlementId: z.string().min(1),
					assetId: z.string().min(1).optional(),
					userId: z.string().min(1).optional(),
				})
				.refine((input) => Boolean(input.assetId) !== Boolean(input.userId), {
					message: "Exactly one allocation target is required",
				}),
		)
		.output(z.object({ id: z.string() })),
	revokeSoftwareAllocation: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(z.object({ revoked: z.boolean() })),
	readSoftwareCompliance: oc.output(
		z.object({
			summary: z.object({
				compliant: z.number().int().nonnegative(),
				unlicensed: z.number().int().nonnegative(),
				expired: z.number().int().nonnegative(),
				overAllocated: z.number().int().nonnegative(),
			}),
			installs: z.array(
				z.object({
					productId: z.string(),
					productName: z.string(),
					assetId: z.string(),
					assetName: z.string(),
					entitlementId: z.string().nullable(),
					status: z.enum([
						"compliant",
						"unlicensed",
						"expired",
						"over-allocated",
					]),
				}),
			),
		}),
	),
};
