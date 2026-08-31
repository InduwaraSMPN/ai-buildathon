/**
 * Database-level tests for the connector schema.
 *
 * The pure suites prove the decisions. These prove the constraints those
 * decisions rely on actually exist in Postgres — a different claim, and the
 * one that was previously untested.
 *
 * Isolation is transaction rollback on a single connection. That approach
 * breaks when the code under test opens its own connection or commits
 * independently — which `createConnectorStore` does — but these tests exercise
 * the *constraints* directly through raw SQL, so the limitation does not
 * apply and the speed is worth having. Cloning a database per test was tried
 * first and is far too slow: the template is 128 tables and is held open by
 * the running dev server.
 *
 * Skipped without `DATABASE_URL`, matching `tier3-integration.test.ts`.
 * Nothing is committed, so a run leaves the development database untouched.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

/**
 * Runs one test inside a transaction that is always rolled back.
 *
 * Seeds an environment, a connector, and a ticket, because every constraint
 * below needs something to hang off. Ids are literal rather than random so a
 * failure message names the row it was about.
 */
/**
 * One connection for the whole file, reused across tests.
 *
 * A client per test was tried first and hung: six test files run in parallel
 * against a development database that also has a dev server attached, and the
 * connection churn was enough to stall. One connection, opened lazily and
 * closed at the end, removes the variable entirely — and since every test
 * rolls back, sharing it costs no isolation.
 */
let shared: Client | undefined;

/**
 * Tickets that carry no connector rows yet.
 *
 * Taking the oldest tickets outright was enough until the demo seed grew a
 * connector: a seeded origin row trips `itsm_ticket_origins_pkey` before the
 * index under test, and a seeded ledger row inflates the dispatch counts. These
 * tests assert on constraints, so they have to start from a ticket nothing has
 * claimed rather than from whichever ticket happens to be oldest.
 */
const UNCLAIMED_TICKETS = `
	SELECT t.id FROM tickets t
	WHERE NOT EXISTS (SELECT 1 FROM itsm_ticket_origins o WHERE o.ticket_id = t.id)
	  AND NOT EXISTS (SELECT 1 FROM itsm_dispatch_ledger d WHERE d.ticket_id = t.id)
	ORDER BY t.created_at
	LIMIT 2`;

async function connection(): Promise<Client> {
	if (!shared) {
		shared = new Client({ connectionString: databaseUrl });
		await shared.connect();
	}
	return shared;
}

test.after(async () => {
	await shared?.end();
	shared = undefined;
});

async function inRollback(
	run: (
		client: Client,
		seed: { ticketId: string; runId: string },
	) => Promise<void>,
) {
	const client = await connection();
	try {
		await client.query("BEGIN");
		// Fail fast and legibly rather than hanging for the runner's timeout.
		await client.query("SET LOCAL lock_timeout = '4s'");
		await client.query("SET LOCAL statement_timeout = '10s'");

		await client.query(
			`INSERT INTO environments (id, key, label, connection_type, mode)
			 VALUES ('env-test-shadow', 'test-shadow', 'Test (shadow)', 'in_cluster', 'shadow')`,
		);
		await client.query(
			`INSERT INTO itsm_connectors
			   (id, key, vendor, label, base_url, client_id, client_secret_encrypted,
			    ticket_origin, default_environment_id, fallback_reporter_id)
			 VALUES ('conn-test', 'test', 'servicenow', 'Test', 'https://t.service-now.com',
			         'cid', 'v1:x:y:z', 'itsm', 'env-test-shadow', 'user-test')`,
		);

		const { rows: tickets } = await client.query(UNCLAIMED_TICKETS);
		const { rows: runs } = await client.query(
			"SELECT id FROM agent_runs ORDER BY started_at LIMIT 1",
		);
		if (!tickets.length) return;

		await run(client, {
			ticketId: tickets[0].id,
			runId: runs[0]?.id ?? "",
		});
	} finally {
		await client.query("ROLLBACK").catch(() => undefined);
	}
}

test("the itsm ticket origin is unique per connector and external id", {
	skip: !databaseUrl,
}, async () => {
	await inRollback(async (client) => {
		// Two different tickets: `ticket_id` is the primary key, so reusing one
		// would trip that instead of the (connector_id, external_id) index this
		// test is actually about.
		const { rows } = await client.query(UNCLAIMED_TICKETS);
		if (rows.length < 2) return;

		const insert = (ticketId: string) =>
			client.query(
				`INSERT INTO itsm_ticket_origins
					   (ticket_id, connector_id, external_id, external_key, foreign_updated_at)
					 VALUES ($1, 'conn-test', 'sys-1', 'INC0010023', now())`,
				[ticketId],
			);
		await insert(rows[0].id);
		// The same foreign record must not become a second ticket. This index
		// is the ingestion idempotency key — the insert is the claim.
		await assert.rejects(() => insert(rows[1].id), /duplicate key/i);
	});
});

test("one transition equals at most one dispatch", {
	skip: !databaseUrl,
}, async () => {
	await inRollback(async (client, seed) => {
		const ticketId = seed.ticketId;

		const claim = (id: string) =>
			client.query(
				`INSERT INTO itsm_dispatch_ledger
					   (id, ticket_id, connector_id, trigger_key, outcome)
					 VALUES ($1, $2, 'conn-test', 'comment:cmt-9', 'dispatched')`,
				[id, ticketId],
			);
		await claim("led-1");
		// Re-observing the same transition claims nothing new, which is what
		// stops a poller starting a second run for one change.
		await assert.rejects(() => claim("led-2"), /duplicate key/i);
	});
});

test("a different transition on the same ticket is a separate claim", {
	skip: !databaseUrl,
}, async () => {
	await inRollback(async (client, seed) => {
		const ticketId = seed.ticketId;
		await client.query(
			`INSERT INTO itsm_dispatch_ledger (id, ticket_id, connector_id, trigger_key, outcome)
				 VALUES ('led-a', $1, 'conn-test', 'comment:cmt-1', 'dispatched'),
				        ('led-b', $1, 'conn-test', 'comment:cmt-2', 'dispatched')`,
			[ticketId],
		);
		const { rows: counted } = await client.query(
			"SELECT count(*)::int n FROM itsm_dispatch_ledger WHERE ticket_id = $1",
			[ticketId],
		);
		assert.equal(counted[0].n, 2);
	});
});

test("a write-back cannot exceed its own attempt ceiling", {
	skip: !databaseUrl,
}, async () => {
	await inRollback(async (client, seed) => {
		await assert.rejects(
			() =>
				client.query(
					`INSERT INTO itsm_writebacks
						   (id, connector_id, ticket_id, payload, attempt_count, max_attempts)
						 VALUES ('wb-1', 'conn-test', $1, '{}'::jsonb, 6, 5)`,
					[seed.ticketId],
				),
			/itsm_writebacks_attempt_within_max/,
		);
	});
});

test("a connector owning synced tickets cannot be deleted out from under them", {
	skip: !databaseUrl,
}, async () => {
	await inRollback(async (client, seed) => {
		await client.query(
			`INSERT INTO itsm_ticket_origins
				   (ticket_id, connector_id, external_id, external_key, foreign_updated_at)
				 VALUES ($1, 'conn-test', 'sys-1', 'INC0010023', now())`,
			[seed.ticketId],
		);
		// ON DELETE restrict: otherwise those tickets would silently become
		// indistinguishable from native ones, with their actions re-enabled.
		await assert.rejects(
			() => client.query(`DELETE FROM itsm_connectors WHERE id = 'conn-test'`),
			/violates RESTRICT setting/i,
		);
	});
});

test("one proposal per run, so a replayed terminal cannot double-count", {
	skip: !databaseUrl,
}, async () => {
	await inRollback(async (client, seed) => {
		const { rows } = await client.query(
			"SELECT r.id run_id, r.ticket_id FROM agent_runs r LIMIT 1",
		);
		if (!rows.length) return;

		const insert = (id: string) =>
			client.query(
				`INSERT INTO itsm_proposals
					   (id, run_id, ticket_id, connector_id, suppressed_calls)
					 VALUES ($1, $2, $3, 'conn-test', '[]'::jsonb)`,
				[id, seed.runId, seed.ticketId],
			);
		await insert("prop-1");
		await assert.rejects(() => insert("prop-2"), /duplicate key/i);
	});
});

test("the itsm ticket origin seeds its vocabulary row", {
	skip: !databaseUrl,
}, async () => {
	await inRollback(async (client) => {
		const { rows } = await client.query(
			`SELECT name FROM ticket_origins WHERE key = 'itsm'`,
		);
		// Origin is runtime vocabulary, not an enum; the migration adds the row
		// rather than the code adding a constant.
		assert.equal(rows[0]?.name, "ITSM connector");
	});
});
