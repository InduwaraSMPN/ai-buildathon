import assert from "node:assert/strict";
import test from "node:test";
import { dashboardArrangementRows } from "./dashboards";

test("widget arrangement is persisted as ordered user-owned rows", () => {
	assert.deepEqual(
		dashboardArrangementRows(
			"analyst-1",
			[
				{ widgetKey: "volume", width: 2 },
				{ widgetKey: "median-ttr", settings: { days: 30 } },
			],
			(key) => `analyst-1:${key}`,
		),
		[
			{
				id: "analyst-1:volume",
				userId: "analyst-1",
				widgetKey: "volume",
				position: 0,
				width: 2,
				settings: null,
			},
			{
				id: "analyst-1:median-ttr",
				userId: "analyst-1",
				widgetKey: "median-ttr",
				position: 1,
				width: 1,
				settings: { days: 30 },
			},
		],
	);
});

test("duplicate widgets are rejected before persistence", () => {
	assert.throws(
		() =>
			dashboardArrangementRows(
				"analyst-1",
				[{ widgetKey: "volume" }, { widgetKey: "volume" }],
				(key) => key,
			),
		RangeError,
	);
});
