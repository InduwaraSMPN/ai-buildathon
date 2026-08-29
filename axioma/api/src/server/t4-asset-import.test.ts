import assert from "node:assert/strict";
import test from "node:test";
import { MAX_CSV_BYTES, parseCsv, previewAssetCsv } from "./assets/csv";
import { planAssetUpserts } from "./t4-asset-import";

test("CSV preview handles quoted fields and writes nothing", () => {
	const preview = previewAssetCsv(
		'asset_tag,name,serial_number\r\nL-1,"Laptop, 15""",SER-1\r\n',
		["asset_tag"],
	);
	assert.deepEqual(preview.accepted[0]?.values, {
		asset_tag: "L-1",
		name: 'Laptop, 15"',
		serial_number: "SER-1",
	});
	assert.equal(preview.rejected.length, 0);
});

test("CSV preview rejects malformed rows and missing identities with reasons", () => {
	const preview = previewAssetCsv(
		"asset_tag,name,serial_number\n,Laptop,SER-1\nL-2,Monitor\n",
		["asset_tag"],
	);
	assert.deepEqual(
		preview.rejected.map(({ rowNumber, reason }) => ({ rowNumber, reason })),
		[
			{ rowNumber: 2, reason: "Missing identity value: asset_tag" },
			{ rowNumber: 3, reason: "Expected 3 columns, received 2" },
		],
	);
});

test("declared identities produce deterministic inserts, updates and duplicate rejection", () => {
	const candidates = previewAssetCsv(
		"asset_tag,name\nL-1,New name\nL-2,New laptop\nL-2,Duplicate\nL-3,\n",
		["asset_tag"],
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
		plan.rejected.map((entry) => entry.reason),
		["Duplicate identity in CSV", "Missing required value: name"],
	);
});

test("CSV parsing rejects unsafe resource use and malformed quoting", () => {
	assert.throws(() => parseCsv("x".repeat(MAX_CSV_BYTES + 1)), /exceeds/);
	assert.throws(() => parseCsv('name\n"unfinished'), /unterminated/);
	assert.throws(() => previewAssetCsv("name,name\na,b", ["name"]), /unique/);
	assert.throws(() => previewAssetCsv("name\na", ["asset_tag"]), /missing/);
});
