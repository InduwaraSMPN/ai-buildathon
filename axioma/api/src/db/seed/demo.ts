/**
 * Demo-data seed entry point.
 *
 * Execution order respects FK dependencies:
 * users → cmdb → assets-devices → knowledge → software-suppliers
 * → tickets → changes-problems → mail → scheduling → automation → connectors → misc
 *
 * Idempotent: rerunning `pnpm seed:demo` is a no-op (row counts must match).
 * Never modifies or deletes the 2 existing real users.
 *
 * Usage: pnpm seed:demo  (or: npx tsx src/db/seed/demo.ts)
 */

import { db } from "@/db";
import { searchReconciliationState } from "@/db/schema";
import { seedAgent } from "./agent";
import { seedAssetLifecycle } from "./asset-lifecycle";
import { seedAssetsAndDevices } from "./assets-devices";
import { seedAutomation } from "./automation";
import { seedProblemsAndChanges } from "./changes-problems";
import { seedCmdb } from "./cmdb";
import { seedConnectors } from "./connectors";
import { seedExtras } from "./extras";
import { seedIdentity } from "./identity";
import { seedInventory } from "./inventory";
import { seedKnowledge } from "./knowledge";
import { seedMail } from "./mail";
import { seedMisc } from "./misc";
import { seedScheduling } from "./scheduling";
import { seedSoftwareSuppliers } from "./software-suppliers";
import { seedStatus } from "./status";
import { seedTickets } from "./tickets";
import { seedUsers } from "./users";

async function main(): Promise<void> {
	console.log("[seed:demo] starting…");

	// 1. Users first — includes assertAdministratorRemains
	await seedUsers();

	// 2. CMDB — independent, early
	await seedCmdb();

	// 3. Assets + devices
	await seedAssetsAndDevices();

	// 4. Knowledge
	await seedKnowledge();

	// 5. Software + suppliers
	await seedSoftwareSuppliers();

	// 6. Tickets — must come before anything that links to tickets
	const ticketIds = await seedTickets();
	if (!ticketIds.length) {
		console.warn(
			"[seed:demo] no tickets created — downstream seeds will be partial",
		);
	}

	// 7. Problems + Changes
	await seedProblemsAndChanges(ticketIds);

	// 8. Mail
	await seedMail(ticketIds);

	// 9. Scheduling
	await seedScheduling(ticketIds);

	// 10. Automation
	await seedAutomation(ticketIds);

	// 11. Connectors — also ensures environments exist if misc hasn't run
	await seedConnectors(ticketIds);

	// 12. Misc — environments (if not yet), documents, notifications, saved views, dashboard widgets, api keys, approvals
	await seedMisc(ticketIds);

	// 13. Service status page — independent of everything above
	await seedStatus();

	// 14. Asset lifecycle — import runs/rejections/history/checkout (needs assets)
	await seedAssetLifecycle();

	// 15. Device inventory — needs both assets and devices
	await seedInventory();

	// 16. Identity — auth providers, directory identities, sync history (needs users)
	await seedIdentity();

	// 17. Agent runs, transcripts and tool calls (needs tickets + environments)
	await seedAgent(ticketIds);

	// 18. Everything else — dynamic fields, ticket links/merges, change
	// transitions, CSAT, team roles, followups, holidays, CMDB extras, channels
	await seedExtras(ticketIds);

	// Everything above is written with backdated timestamps so the demo looks
	// lived-in. The search projection is reconciled forward from a watermark, so
	// a row whose `updated_at` is older than that watermark is never picked up —
	// seeded knowledge would sit outside the index permanently, and the agent's
	// forced knowledge search would find nothing. Rewinding the watermark makes
	// the next sweep reconsider everything the seed just wrote.
	await db.delete(searchReconciliationState);
	console.log(
		"[seed:demo] search watermark reset; the next sweep will index the seed",
	);

	console.log("[seed:demo] completed successfully");

	// Quick row-count report for verification
	try {
		const counts = await getRowCounts();
		console.log("[seed:demo] row counts:", JSON.stringify(counts, null, 2));
	} catch (e) {
		console.warn("[seed:demo] could not fetch row counts:", e);
	}

	await gracefulExit();
}

async function getRowCounts(): Promise<Record<string, number>> {
	// Lightweight counts for verification output — not exhaustive but covers the spec's union query idea
	const { sql } = await import("drizzle-orm");
	const queries: Array<{ key: string; sql: ReturnType<typeof sql> }> = [
		{
			key: "users",
			sql: sql`select count(*)::int as c from "user" where id like 'demo-%'`,
		},
		{
			key: "departments",
			sql: sql`select count(*)::int as c from departments where id like 'demo-%'`,
		},
		{
			key: "teams",
			sql: sql`select count(*)::int as c from teams where id like 'demo-%'`,
		},
		{ key: "tickets", sql: sql`select count(*)::int as c from tickets` },
		// createProblem() generates its own UUID, so demo problems carry no id prefix.
		{ key: "problems", sql: sql`select count(*)::int as c from problems` },
		{
			key: "changes",
			sql: sql`select count(*)::int as c from changes where id like 'demo-%'`,
		},
		{
			key: "assets",
			sql: sql`select count(*)::int as c from assets where id like 'demo-%'`,
		},
		{
			key: "devices",
			sql: sql`select count(*)::int as c from devices where id like 'demo-%'`,
		},
		{
			key: "knowledge_articles",
			sql: sql`select count(*)::int as c from knowledge_articles where id like 'demo-%'`,
		},
		{
			key: "cmdb_objects",
			sql: sql`select count(*)::int as c from cmdb_objects where id like 'demo-%'`,
		},
	];
	const result: Record<string, number> = {};
	for (const q of queries) {
		try {
			const rows = (await db.execute(q.sql)) as unknown as {
				rows: Array<{ c: number }>;
			};
			result[q.key] = Number(rows.rows?.[0]?.c ?? 0);
		} catch {
			// Fallback via direct count query if execute shape differs
			try {
				const alt = (await db.execute(q.sql)) as unknown as Array<{
					c: number;
				}>;
				result[q.key] = Number(
					(alt as unknown as { rows?: Array<{ c: number }> })?.rows?.[0]?.c ??
						(alt as Array<{ c: number }>)[0]?.c ??
						0,
				);
			} catch {
				result[q.key] = -1;
			}
		}
	}
	return result;
}

async function gracefulExit(): Promise<void> {
	// Close drizzle pool if possible
	try {
		const { db: dbInstance } = await import("@/db");
		// drizzle node-postgres exposes a client pool via $client or similar — best effort
		const client = dbInstance as unknown as {
			$client?: { end?: () => Promise<void> };
			client?: { end?: () => Promise<void> };
		};
		if (client.$client?.end) await client.$client.end();
		else if (client.client?.end) await client.client.end();
		else {
			// Try to locate pg Pool via env — fallback: just exit
		}
	} catch {}
	process.exit(0);
}

main().catch(async (err) => {
	console.error("[seed:demo] failed:", err);
	process.exit(1);
});
