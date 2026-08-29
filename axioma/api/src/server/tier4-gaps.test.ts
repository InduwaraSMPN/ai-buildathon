import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
	readFileSync(new URL(path, import.meta.url), "utf8");

test("recurrence routes share atomic generator and server sweep lifecycle", () => {
	const router = read("./routers/tier4.ts");
	const runtime = read("./scheduling-runtime.ts");
	const server = read("../index.ts");
	for (const route of [
		"listRecurrences",
		"createRecurrence",
		"updateRecurrence",
		"deleteRecurrence",
	])
		assert.match(router, new RegExp(`${route}:`));
	assert.match(router, /generateDueRecurrences\(input\.now, input\.limit\)/);
	assert.match(runtime, /db\.transaction\(async \(tx\)/);
	assert.match(server, /startRecurrenceSweep\(\)/);
	assert.match(server, /closeRecurrenceSweep\(\)/);
});

test("calendar, status admin, contract SLA, and overview arrangement are wired", () => {
	const router = read("./routers/tier4.ts");
	const sla = read("./sla/runtime.ts");
	const overview = read(
		"../../../dashboard/src/features/overview/components/overview-page.tsx",
	);
	assert.match(router, /ticketNumber: tickets\.number/);
	assert.match(router, /upsertStatusService:/);
	assert.match(router, /upsertImpactLevel:/);
	assert.match(router, /createStatusIncident:/);
	assert.match(router, /changes\.outageStartAt/);
	assert.match(sla, /resolveContractSla\(service\.id, at, coverage\)/);
	assert.match(overview, /getDashboardArrangement/);
	assert.match(overview, /orderedOverviewWidgets\(arrangement\.data\)/);
});
