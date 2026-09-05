#!/usr/bin/env node
/**
 * Removes test residue from a database.
 *
 * The `*.db.test.ts` suites write through `@/db`, which reads the same
 * `DATABASE_URL` as the development database the product demo is shown from.
 * Suites that did not clean up after themselves left thousands of rows there:
 * the ticket queue opened two-thirds full of "Device command proposal test" and
 * the device command review page opened on a wall of test proposals. The suites
 * clean up now; this removes what they left behind, and stays available for the
 * next run that is killed before its `finally`.
 *
 * Two things make this safe to point at a database somebody cares about.
 *
 * The first is that every predicate is a literal — an exact title, hostname
 * shape, reason, or the reserved `test-` id prefix that
 * `src/server/testing/fixtures.ts` mints. Nothing here matches on a range, a
 * date, or a status, and every predicate additionally excludes `demo-%` ids.
 * That exclusion is not decoration: `demo-agent-run-for-proposals` and
 * `demo-agent-run-for-proposals-02` are seeded demo rows that match the
 * boot-sweep artefact shape exactly, and the guard is the only thing that
 * keeps the `/device-commands` demo intact.
 *
 * The second is that a dry run is the default, and it is not an estimate: the
 * deletes actually run inside a transaction that is then rolled back, so the
 * counts reported are the counts a subsequent `--apply` will produce, and the
 * statements are proven to execute before anything is committed.
 *
 * Usage:
 *   node scripts/purge-test-residue.mjs            # dry run, deletes nothing
 *   node scripts/purge-test-residue.mjs --apply    # commits
 */

import process from "node:process";
import "dotenv/config";
import pg from "pg";

const apply = process.argv.includes("--apply");

const fail = (message) => {
	console.error(message);
	process.exit(1);
};

// A production database has no test residue in it by definition, so a run here
// can only be a mistake — and it is the one place where a mistake is unrecoverable.
if (process.env.NODE_ENV === "production") {
	fail(
		"Refusing to run with NODE_ENV=production.\n" +
			"This script only ever has work to do on a database that tests write to.",
	);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is not set.");

/**
 * Devices seeded by `device-proposal.db.test.ts`.
 *
 * `host-<8 hex>` is the hostname that suite generated before it was given a
 * prefix; `test-host-%` is what it generates now. Demo devices are named for
 * their owner's team — ENG-LT-001, SALES-LT-042 — so neither shape can reach one.
 */
const TEST_DEVICES = `
	SELECT id FROM devices
	WHERE id NOT LIKE 'demo-%'
	  AND (
	    hostname ~ '^host-[0-9a-f]{8}$'
	    OR hostname LIKE 'test-host-%'
	    OR id LIKE 'test-%'
	  )`;

/**
 * Tickets seeded by a test suite.
 *
 * The two titles are literals lifted from the suites that write them. Demo
 * tickets carry generated uuid ids and real-sounding titles, so the title match
 * cannot reach one, and the id-prefix match cannot either.
 */
const TEST_TICKETS = `
	SELECT id FROM tickets
	WHERE id NOT LIKE 'demo-%'
	  AND (
	    title = 'Device command proposal test'
	    OR (title = 'Runtime ticket' AND id LIKE 'rt-%')
	    OR id LIKE 'test-%'
	  )`;

/**
 * Users seeded by a test suite.
 *
 * The demo's own people are `demo-user-*` with `@axioma.demo` addresses, and
 * real accounts come from the identity provider, so the two fixture names below
 * — paired with a reserved-by-RFC-2606 address — reach neither.
 */
const TEST_USERS = `
	SELECT id FROM "user"
	WHERE id NOT LIKE 'demo-%'
	  AND (
	    id LIKE 'test-%'
	    OR (
	      name IN ('Proposal test reporter', 'Run starter')
	      AND email LIKE '%@example.invalid'
	    )
	    OR (name = 'runtime test' AND id LIKE 'rt-user-%')
	  )`;

/**
 * Workflows seeded by a test suite. Both names are literals lifted from the
 * suites that write them; the demo seeds `demo-workflow-01` through `-03`.
 */
const TEST_WORKFLOWS = `
	SELECT id FROM workflows
	WHERE id NOT LIKE 'demo-%'
	  AND (
	    (id LIKE 'test-%' AND name = 'Ticket creation test')
	    OR name = 'lease test'
	  )`;

/**
 * Children before parents.
 *
 * Most of these edges cascade, but two do not behave the way a reader would
 * assume: `device_command_proposals.ticket_id` carries no foreign key at all,
 * so a proposal outlives its ticket, and `tickets.reporter_id` cascades from
 * the *user*, so deleting a fixture user takes its tickets with it. Deleting
 * explicitly in this order means every count below is a direct delete rather
 * than a cascade nobody sees.
 */
const STEPS = [
	{
		table: "device_command_proposals",
		note: "device-proposal.db.test.ts",
		sql: `DELETE FROM device_command_proposals
		      WHERE id NOT LIKE 'demo-%'
		        AND (
		          id LIKE 'test-%'
		          OR (
		            reason IN (
		              'A reason long enough to satisfy the schema bound.',
		              'The resolver cache is stale and no typed action covers it.'
		            )
		            AND device_id IN (${TEST_DEVICES})
		          )
		          OR ticket_id IN (${TEST_TICKETS})
		        )`,
	},
	{
		table: "device_commands",
		note: "gateway dispatch fixtures",
		sql: `DELETE FROM device_commands
		      WHERE id NOT LIKE 'demo-%'
		        AND (device_id IN (${TEST_DEVICES}) OR proposal_id LIKE 'test-%')`,
	},
	{
		table: "devices",
		note: "host-<hex> / test-host-* fixtures",
		sql: `DELETE FROM devices WHERE id IN (${TEST_DEVICES})`,
	},
	{
		table: "agent_runs",
		note: "runs belonging to fixture tickets",
		sql: `DELETE FROM agent_runs
		      WHERE id NOT LIKE 'demo-%'
		        AND (id LIKE 'test-%' OR ticket_id IN (${TEST_TICKETS}))`,
	},
	{
		// A separate pass, and not test residue: these are written by the gateway
		// boot sweep, which fails every run still marked running when the process
		// restarts. A run that recorded no step at all never did any work, so the
		// row carries nothing a person could read — it is only noise in the run
		// list. Anything seeded is spared by the `demo-%` guard, which is what
		// keeps `demo-run-06` (same status, same outcome) and the two
		// `demo-agent-run-for-proposals` rows in place.
		table: "agent_runs",
		note: "boot-sweep artefacts with no steps",
		sql: `DELETE FROM agent_runs r
		      WHERE r.id NOT LIKE 'demo-%'
		        AND r.status = 'failed'
		        AND r.outcome = 'gateway restarted during run'
		        AND NOT EXISTS (SELECT 1 FROM agent_steps s WHERE s.run_id = r.id)`,
	},
	{
		table: "tickets",
		note: "fixture tickets",
		sql: `DELETE FROM tickets WHERE id IN (${TEST_TICKETS})`,
	},
	{
		table: `"user"`,
		note: "fixture reporters and run starters",
		sql: `DELETE FROM "user" WHERE id IN (${TEST_USERS})`,
	},
	// An independent chain, not reachable from anything above. `workflows` is
	// matched by name as well as by prefix because `workflows/runtime.test.ts`
	// still mints bare uuids; the demo's own three are `demo-workflow-*`.
	{
		table: "workflow_executions",
		note: "executions of fixture workflows",
		sql: `DELETE FROM workflow_executions WHERE workflow_id IN (${TEST_WORKFLOWS})`,
	},
	{
		table: "workflows",
		note: "fixture workflows",
		sql: `DELETE FROM workflows WHERE id IN (${TEST_WORKFLOWS})`,
	},
];

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

let total = 0;
const rows = [];
try {
	await client.query("BEGIN");
	for (const step of STEPS) {
		const result = await client.query(step.sql);
		rows.push({ ...step, deleted: result.rowCount ?? 0 });
		total += result.rowCount ?? 0;
	}
	await client.query(apply ? "COMMIT" : "ROLLBACK");
} catch (error) {
	await client.query("ROLLBACK").catch(() => undefined);
	throw error;
} finally {
	await client.end();
}

const width = Math.max(...rows.map((row) => row.table.length), 5);
console.log(apply ? "Deleted:" : "Would delete (dry run):");
for (const row of rows) {
	console.log(
		`  ${row.table.padEnd(width)}  ${String(row.deleted).padStart(6)}  ${row.note}`,
	);
}
console.log(`  ${"total".padEnd(width)}  ${String(total).padStart(6)}`);
if (!apply) {
	console.log("\nNothing was committed. Re-run with --apply to delete.");
}
