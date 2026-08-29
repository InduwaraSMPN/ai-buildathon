import assert from "node:assert/strict";
import test from "node:test";
import { MAX_CSV_BYTES, parseCsv } from "./csv";

process.env.SKIP_ENV_VALIDATION = "true";

const assetImport = await import("./import");
const { planAssetUpserts, previewAssetImport } = assetImport;

const input = (csv: string) => ({
	profileId: "test-profile",
	identityColumns: ["asset_tag"],
	csv,
});

test("CSV preview handles quoted fields and writes nothing", () => {
	const preview = previewAssetImport(
		input('asset_tag,name,serial_number\r\nL-1,"Laptop, 15""",SER-1\r\n'),
	);
	assert.deepEqual(preview.accepted[0]?.values, {
		asset_tag: "L-1",
		name: 'Laptop, 15"',
		serial_number: "SER-1",
	});
	assert.equal(preview.rejected.length, 0);
});

test("CSV preview rejects malformed rows and missing identities with reasons", () => {
	const preview = previewAssetImport(
		input("asset_tag,name,serial_number\n,Laptop,SER-1\nL-2,Monitor\n"),
	);
	assert.deepEqual(
		preview.rejected.map(({ rowNumber, reason }) => ({ rowNumber, reason })),
		[
			{ rowNumber: 2, reason: "Missing identity value: asset_tag" },
			{ rowNumber: 3, reason: "Expected 3 columns, received 2" },
		],
	);
});

test("production planner creates inserts and updates and reports rejected rows", () => {
	const candidates = previewAssetImport(
		input(
			"asset_tag,name\nL-1,New name\nL-2,New laptop\nL-2,Duplicate\nL-3,\n",
		),
	).accepted;
	const existingKey = candidates[0]?.identityKey;
	assert.ok(existingKey);
	const plan = planAssetUpserts(
		candidates,
		new Map([[existingKey, "asset-existing"]]),
	);
	assert.deepEqual(
		plan.operations.map((operation) => [
			operation.kind,
			operation.identityKey,
			"assetId" in operation ? operation.assetId : null,
		]),
		[
			["update", candidates[0]?.identityKey, "asset-existing"],
			["insert", candidates[1]?.identityKey, null],
		],
	);
	assert.deepEqual(
		plan.rejected.map(({ rowNumber, reason, row }) => ({
			rowNumber,
			reason,
			row,
		})),
		[
			{
				rowNumber: 4,
				reason: "Duplicate identity in CSV",
				row: { asset_tag: "L-2", name: "Duplicate" },
			},
			{
				rowNumber: 5,
				reason: "Missing required value: name",
				row: { asset_tag: "L-3", name: "" },
			},
		],
	);
});

test("import provenance stays complete while declared fields are converted", () => {
	const row = {
		asset_tag: "L-1",
		name: "Laptop",
		purchase_year: "2024",
		site: "Colombo",
		source_note: "legacy",
	};
	assert.deepEqual(assetImport.assetValues(row).attributes, row);
	assert.deepEqual(
		{
			purchase_year: assetImport.parseImportedDynamicValue(
				"integer",
				row.purchase_year,
			),
			site: assetImport.parseImportedDynamicValue("text", row.site),
		},
		{ purchase_year: 2024, site: "Colombo" },
	);
	assert.throws(() =>
		assetImport.parseImportedDynamicValue("integer", "2024.5"),
	);
	assert.throws(() => assetImport.parseImportedDynamicValue("checkbox", "yes"));
	assert.throws(() =>
		assetImport.parseImportedDynamicValue("multiselect", "one,two"),
	);
});

test("CSV parsing rejects unsafe resource use and malformed quoting", () => {
	assert.throws(() => parseCsv("x".repeat(MAX_CSV_BYTES + 1)), /exceeds/);
	assert.throws(() => parseCsv('name\n"unfinished'), /unterminated/);
	assert.throws(() => previewAssetImport(input("name,name\na,b")), /unique/);
	assert.throws(() => previewAssetImport(input("name\na")), /missing/);
});
