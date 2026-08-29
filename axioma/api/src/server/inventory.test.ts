import assert from "node:assert/strict";
import test from "node:test";
import { MAX_INVENTORY_CLOCK_SKEW_MS, parseInventoryReport } from "./inventory";

test("inventory report parsing validates metadata and payload", () => {
	const parsed = parseInventoryReport({
		reportId: "report-1",
		collectedUnixMs: "1788000000000",
		inventoryJson: '{"software":{"ok":true,"data":{"applications":[]}}}',
	});
	assert.equal(parsed.id, "report-1");
	assert.equal(parsed.payload.software?.ok, true);
	assert.throws(
		() =>
			parseInventoryReport({
				reportId: "",
				collectedUnixMs: 1,
				inventoryJson: "{}",
			}),
		/metadata/,
	);
	assert.throws(
		() =>
			parseInventoryReport({
				reportId: "x",
				collectedUnixMs: 1,
				inventoryJson: "no",
			}),
		/JSON/,
	);
});

test("inventory report rejects timestamps beyond allowed clock skew", () => {
	const now = 1_788_000_000_000;
	const report = {
		reportId: "report-1",
		inventoryJson: "{}",
	};
	assert.doesNotThrow(() =>
		parseInventoryReport(
			{ ...report, collectedUnixMs: now + MAX_INVENTORY_CLOCK_SKEW_MS },
			now,
		),
	);
	assert.throws(
		() =>
			parseInventoryReport(
				{ ...report, collectedUnixMs: now + MAX_INVENTORY_CLOCK_SKEW_MS + 1 },
				now,
			),
		/metadata/,
	);
});
