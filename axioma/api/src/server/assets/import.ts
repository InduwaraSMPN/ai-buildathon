import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
	assetHistory,
	assetImportIdentities,
	assetImportProfiles,
	assetImportRejections,
	assetImportRuns,
	assets,
} from "@/db/schema/assets";
import {
	type DynamicFieldType,
	dynamicFields,
	dynamicFieldValues,
} from "@/db/schema/dynamic-fields";
import { validateFieldValue } from "../dynamic-fields";
import { indexAsset } from "../search/projections";
import {
	type AssetImportCandidate,
	type AssetImportRejection,
	type CsvRow,
	previewAssetCsv,
} from "./csv";

export type AssetImportInput = {
	profileId: string;
	identityColumns: readonly string[];
	dynamicFieldColumns?: Readonly<Record<string, string>>;
	csv: string;
	fileName?: string;
};

export type AssetImportResult = {
	runId: string;
	inserted: number;
	updated: number;
	rejected: number;
};

export type AssetImportOperation =
	| { kind: "insert"; identityKey: string; rowNumber: number; values: CsvRow }
	| {
			kind: "update";
			assetId: string;
			identityKey: string;
			rowNumber: number;
			values: CsvRow;
	  };

export function planAssetUpserts(
	candidates: readonly AssetImportCandidate[],
	existingAssets: ReadonlyMap<string, string>,
): { operations: AssetImportOperation[]; rejected: AssetImportRejection[] } {
	const operations: AssetImportOperation[] = [];
	const rejected: AssetImportRejection[] = [];
	const seen = new Set<string>();

	for (const candidate of candidates) {
		let reason: string | undefined;
		if (!candidate.values.name) reason = "Missing required value: name";
		else if (seen.has(candidate.identityKey))
			reason = "Duplicate identity in CSV";
		if (reason) {
			rejected.push({
				rowNumber: candidate.rowNumber,
				reason,
				row: candidate.values,
			});
			continue;
		}
		seen.add(candidate.identityKey);
		const assetId = existingAssets.get(candidate.identityKey);
		operations.push(
			assetId
				? { kind: "update", assetId, ...candidate }
				: { kind: "insert", ...candidate },
		);
	}
	return { operations, rejected };
}

export function assetValues(row: CsvRow) {
	return {
		name: row.name ?? "",
		assetTag: row.asset_tag || null,
		serialNumber: row.serial_number || null,
		attributes: row,
		updatedAt: new Date(),
	};
}

export function parseImportedDynamicValue(
	type: DynamicFieldType,
	value: string,
) {
	if (type === "integer") {
		const parsed = Number(value);
		if (!Number.isSafeInteger(parsed)) throw new TypeError("Invalid integer");
		return parsed;
	}
	if (type === "checkbox") {
		if (value === "true") return true;
		if (value === "false") return false;
		throw new TypeError("Invalid checkbox; expected true or false");
	}
	if (type === "multiselect")
		throw new TypeError("CSV multiselect encoding is not supported");
	return value;
}

type FieldDefinition = typeof dynamicFields.$inferSelect;
type FieldWrite = { fieldId: string; value: unknown };

/**
 * Converts one row's mapped columns, reporting the first bad cell rather than
 * throwing. A blank cell is absence, not a value: `Number("")` is 0, so parsing
 * one would write a silent zero for an integer and reject an optional checkbox
 * outright.
 */
function resolveDynamicValues(
	mappings: readonly (readonly [string, string])[],
	definitionsByKey: ReadonlyMap<string, FieldDefinition>,
	row: CsvRow,
): { values: FieldWrite[] } | { reason: string } {
	const values: FieldWrite[] = [];
	for (const [column, key] of mappings) {
		const definition = definitionsByKey.get(key);
		if (!definition) throw new TypeError(`Unknown asset dynamic field ${key}`);
		const cell = row[column] ?? "";
		if (cell === "") continue;
		try {
			const value = parseImportedDynamicValue(definition.fieldType, cell);
			validateFieldValue(definition, value);
			values.push({ fieldId: definition.id, value });
		} catch (error) {
			return {
				reason: `Invalid value for ${key}: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}
	return { values };
}

/** Preview is deliberately pure: importing is the only path that receives a database. */
export function previewAssetImport(input: AssetImportInput) {
	return previewAssetCsv(input.csv, input.identityColumns);
}

const INDEX_BATCH_SIZE = 25;

/**
 * Indexing happens after the import has committed, so a failure here must not
 * reach the caller: the retry it invites would re-process every row. Batched so
 * a ten-thousand-row import does not open a query per asset at once.
 */
async function indexImportedAssets(assetIds: readonly string[]): Promise<void> {
	for (let start = 0; start < assetIds.length; start += INDEX_BATCH_SIZE) {
		const batch = assetIds.slice(start, start + INDEX_BATCH_SIZE);
		const results = await Promise.allSettled(
			batch.map((id) => indexAsset(db, id)),
		);
		results.forEach((result, index) => {
			if (result.status === "rejected")
				console.error(
					`[assets:import] search indexing failed for ${batch[index]}`,
					result.reason,
				);
		});
	}
}

export async function importAssetsCsv(
	input: AssetImportInput,
): Promise<AssetImportResult> {
	const preview = previewAssetImport(input);
	const mappings = Object.entries(input.dynamicFieldColumns ?? {});
	if (new Set(mappings.map(([, key]) => key)).size !== mappings.length)
		throw new TypeError(
			"Each dynamic field may be mapped from only one CSV column",
		);
	for (const [column] of mappings)
		if (!preview.headers.includes(column))
			throw new TypeError(`Mapped CSV column ${column} was not found`);
	const runId = crypto.randomUUID();
	let inserted = 0;
	let updated = 0;
	let rejectedCount = 0;

	const changedAssetIds: string[] = [];
	await db.transaction(async (tx) => {
		const definitions = mappings.length
			? await tx
					.select()
					.from(dynamicFields)
					.where(
						and(
							eq(dynamicFields.objectType, "asset"),
							eq(dynamicFields.isActive, true),
							inArray(
								dynamicFields.key,
								mappings.map(([, key]) => key),
							),
						),
					)
			: [];
		const definitionsByKey = new Map(
			definitions.map((item) => [item.key, item]),
		);
		for (const [, key] of mappings)
			if (!definitionsByKey.has(key))
				throw new TypeError(`Unknown or inactive asset dynamic field ${key}`);

		await tx
			.insert(assetImportProfiles)
			.values({
				id: input.profileId,
				name: input.profileId,
				identityColumns: [...input.identityColumns],
				dynamicFieldColumns: input.dynamicFieldColumns ?? {},
			})
			.onConflictDoUpdate({
				target: assetImportProfiles.id,
				set: {
					identityColumns: [...input.identityColumns],
					dynamicFieldColumns: input.dynamicFieldColumns ?? {},
				},
			});
		const identities = await tx
			.select({
				identityKey: assetImportIdentities.identityKey,
				assetId: assetImportIdentities.assetId,
			})
			.from(assetImportIdentities)
			.where(eq(assetImportIdentities.profileId, input.profileId));
		const plan = planAssetUpserts(
			preview.accepted,
			new Map(
				identities.map(({ identityKey, assetId }) => [identityKey, assetId]),
			),
		);
		// A bad cell is one row's problem, not the import's: resolving the dynamic
		// values up front turns a parse or validation failure into a rejection
		// alongside the ones previewAssetCsv reports, instead of an exception that
		// escapes the transaction and rolls every accepted row back.
		const writes: { operation: AssetImportOperation; values: FieldWrite[] }[] =
			[];
		const unparseable: AssetImportRejection[] = [];
		for (const operation of plan.operations) {
			const resolved = resolveDynamicValues(
				mappings,
				definitionsByKey,
				operation.values,
			);
			if ("reason" in resolved)
				unparseable.push({
					rowNumber: operation.rowNumber,
					reason: resolved.reason,
					row: operation.values,
				});
			else writes.push({ operation, values: resolved.values });
		}

		const rejected = [...preview.rejected, ...plan.rejected, ...unparseable];
		rejectedCount = rejected.length;
		await tx.insert(assetImportRuns).values({
			id: runId,
			profileId: input.profileId,
			fileName: input.fileName,
			totalRows: preview.accepted.length + preview.rejected.length,
			acceptedRows: writes.length,
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

		for (const { operation, values: fieldValues } of writes) {
			const values = assetValues(operation.values);
			let assetId: string;
			if (operation.kind === "update") {
				await tx
					.update(assets)
					.set(values)
					.where(eq(assets.id, operation.assetId));
				await tx.insert(assetHistory).values({
					id: crypto.randomUUID(),
					assetId: operation.assetId,
					action: "csv_update",
					changes: operation.values,
				});
				assetId = operation.assetId;
				changedAssetIds.push(assetId);
				updated += 1;
			} else {
				const newAssetId = crypto.randomUUID();
				await tx.insert(assets).values({ id: newAssetId, ...values });
				await tx.insert(assetImportIdentities).values({
					id: crypto.randomUUID(),
					profileId: input.profileId,
					identityKey: operation.identityKey,
					assetId: newAssetId,
				});
				await tx.insert(assetHistory).values({
					id: crypto.randomUUID(),
					assetId: newAssetId,
					action: "csv_create",
					changes: operation.values,
				});
				assetId = newAssetId;
				changedAssetIds.push(assetId);
				inserted += 1;
			}
			for (const { fieldId, value } of fieldValues)
				await tx
					.insert(dynamicFieldValues)
					.values({ fieldId, objectId: assetId, value })
					.onConflictDoUpdate({
						target: [dynamicFieldValues.fieldId, dynamicFieldValues.objectId],
						set: { value },
					});
		}
	});
	await indexImportedAssets(changedAssetIds);
	return { runId, inserted, updated, rejected: rejectedCount };
}
