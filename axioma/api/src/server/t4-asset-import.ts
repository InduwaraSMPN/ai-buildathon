import type {
	AssetImportCandidate,
	AssetImportRejection,
	CsvRow,
} from "./assets/csv";

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
