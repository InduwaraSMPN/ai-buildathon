import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
	assetHistory,
	assetImportIdentities,
	assetImportProfiles,
	assetImportRejections,
	assetImportRuns,
	assets,
} from "@/db/schema/assets";
import { indexAsset } from "../search/projections";
import { type CsvRow, previewAssetCsv } from "./csv";

export type AssetImportInput = {
	profileId: string;
	identityColumns: readonly string[];
	csv: string;
	fileName?: string;
};

export type AssetImportResult = {
	runId: string;
	inserted: number;
	updated: number;
	rejected: number;
};

export function assetValues(row: CsvRow) {
	return {
		name: row.name ?? "",
		assetTag: row.asset_tag || null,
		serialNumber: row.serial_number || null,
		attributes: row,
		updatedAt: new Date(),
	};
}

/** Preview is deliberately pure: importing is the only path that receives a database. */
export function previewAssetImport(input: AssetImportInput) {
	return previewAssetCsv(input.csv, input.identityColumns);
}

export async function importAssetsCsv(
	input: AssetImportInput,
): Promise<AssetImportResult> {
	const preview = previewAssetImport(input);
	const runId = crypto.randomUUID();
	let inserted = 0;
	let updated = 0;
	const rejected = [...preview.rejected];
	const seen = new Set<string>();

	for (const candidate of preview.accepted) {
		if (!candidate.values.name) {
			rejected.push({
				rowNumber: candidate.rowNumber,
				reason: "Missing required value: name",
				row: candidate.values,
			});
			continue;
		}
		if (seen.has(candidate.identityKey)) {
			rejected.push({
				rowNumber: candidate.rowNumber,
				reason: "Duplicate identity in CSV",
				row: candidate.values,
			});
			continue;
		}
		seen.add(candidate.identityKey);
	}
	const rejectedRows = new Set(rejected.map((entry) => entry.rowNumber));
	const accepted = preview.accepted.filter(
		(candidate) => !rejectedRows.has(candidate.rowNumber),
	);

	const changedAssetIds: string[] = [];
	await db.transaction(async (tx) => {
		await tx
			.insert(assetImportProfiles)
			.values({
				id: input.profileId,
				name: input.profileId,
				identityColumns: [...input.identityColumns],
			})
			.onConflictDoUpdate({
				target: assetImportProfiles.id,
				set: { identityColumns: [...input.identityColumns] },
			});
		await tx.insert(assetImportRuns).values({
			id: runId,
			profileId: input.profileId,
			fileName: input.fileName,
			totalRows: preview.accepted.length + preview.rejected.length,
			acceptedRows: accepted.length,
			rejectedRows: rejected.length,
		});
		if (rejected.length > 0)
			await tx.insert(assetImportRejections).values(
				rejected.map((entry) => ({
					id: crypto.randomUUID(),
					runId,
					...entry,
				})),
			);

		for (const candidate of accepted) {
			const [identity] = await tx
				.select({ assetId: assetImportIdentities.assetId })
				.from(assetImportIdentities)
				.where(
					and(
						eq(assetImportIdentities.profileId, input.profileId),
						eq(assetImportIdentities.identityKey, candidate.identityKey),
					),
				);
			const assetId = identity?.assetId;
			const values = assetValues(candidate.values);
			if (assetId) {
				await tx.update(assets).set(values).where(eq(assets.id, assetId));
				await tx.insert(assetHistory).values({
					id: crypto.randomUUID(),
					assetId,
					action: "csv_update",
					changes: candidate.values,
				});
				changedAssetIds.push(assetId);
				updated += 1;
			} else {
				const newAssetId = crypto.randomUUID();
				await tx.insert(assets).values({ id: newAssetId, ...values });
				await tx.insert(assetImportIdentities).values({
					id: crypto.randomUUID(),
					profileId: input.profileId,
					identityKey: candidate.identityKey,
					assetId: newAssetId,
				});
				await tx.insert(assetHistory).values({
					id: crypto.randomUUID(),
					assetId: newAssetId,
					action: "csv_create",
					changes: candidate.values,
				});
				changedAssetIds.push(newAssetId);
				inserted += 1;
			}
		}
	});
	await Promise.all(changedAssetIds.map((id) => indexAsset(db, id)));
	return { runId, inserted, updated, rejected: rejected.length };
}
