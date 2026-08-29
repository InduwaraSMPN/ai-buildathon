import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
	readFileSync(new URL(path, import.meta.url), "utf8");

test("Tier-4 routes keep public status, atomic recurrence, and shared document visibility", () => {
	const router = read("./routers/tier4.ts");
	assert.match(router, /readStatus: publicProcedure\.readStatus/);
	assert.match(router, /generateDueRecurrences\(input\.now, input\.limit\)/);
	const recurrence = read("./scheduling-runtime.ts");
	assert.match(recurrence, /db\.transaction\(async \(tx\)/);
	assert.match(recurrence, /tx\s*\.insert\(recurringTicketOccurrences\)/);
	assert.match(recurrence, /await tx\.insert\(tickets\)/);
	assert.match(recurrence, /tx\s*\.update\(recurringTicketOccurrences\)/);
	assert.match(router, /listVisibleDocuments\(input,/);
	assert.match(router, /requireDocumentWriteTarget\(input,/);
});

test("default ticket list excludes only future snoozes", () => {
	const router = read("./routers/index.ts");
	assert.match(
		router,
		/not exists \([\s\S]*ticketScheduling\.snoozedUntil} > now\(\)/,
	);
});
