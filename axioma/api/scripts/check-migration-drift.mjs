import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";

const database = `axioma_drift_${process.pid}`;
const serverUrl =
	process.env.DATABASE_URL ??
	"postgresql://postgres:password@localhost:5432/axioma";
const url = new URL(serverUrl);
url.pathname = `/${database}`;
const run = (command, args, options = {}) =>
	execFileSync(command, args, { encoding: "utf8", stdio: "pipe", ...options });
const drizzle = (args, options = {}) =>
	run(
		process.execPath,
		[process.env.npm_execpath, "exec", "drizzle-kit", ...args],
		options,
	);
const psql = (sql) =>
	run("docker", [
		"exec",
		"axioma-postgres",
		"psql",
		"-v",
		"ON_ERROR_STOP=1",
		"-U",
		"postgres",
		"-d",
		"postgres",
		"-c",
		sql,
	]);

const migrationsUrl = new URL("../src/db/migrations/", import.meta.url);
const journal = JSON.parse(
	readFileSync(new URL("meta/_journal.json", migrationsUrl)),
);
const latest = journal.entries.at(-1);
if (!latest) throw new Error("migration journal is empty");

const sqlTags = readdirSync(migrationsUrl)
	.filter((name) => name.endsWith(".sql"))
	.map((name) => name.slice(0, -4))
	.sort();
const journalTags = journal.entries.map(({ tag }) => tag).sort();
if (JSON.stringify(sqlTags) !== JSON.stringify(journalTags))
	throw new Error(
		`migration SQL and journal differ: ${JSON.stringify({ sqlTags, journalTags })}`,
	);
for (const [index, entry] of journal.entries.entries()) {
	if (entry.idx !== index)
		throw new Error(`migration idx ${entry.idx} must be ${index}`);
	if (index && entry.when <= journal.entries[index - 1].when)
		throw new Error(`migration timestamps are not increasing at ${entry.tag}`);
}

const snapshots = readdirSync(new URL("meta/", migrationsUrl))
	.filter((name) => /^\d{4}_snapshot\.json$/.test(name))
	.sort()
	.map((name) => ({
		name,
		snapshot: JSON.parse(readFileSync(new URL(`meta/${name}`, migrationsUrl))),
	}));
for (const [index, { name, snapshot }] of snapshots.entries()) {
	if (index && snapshot.prevId !== snapshots[index - 1].snapshot.id)
		throw new Error(
			`${name} does not descend from ${snapshots[index - 1].name}`,
		);
}

const deployed = new pg.Client({ connectionString: serverUrl });
await deployed.connect();
try {
	const result = await deployed.query(
		"select count(*) over()::int count, created_at::text from drizzle.__drizzle_migrations order by id desc limit 1",
	);
	if (
		result.rows[0]?.count !== journal.entries.length ||
		result.rows[0]?.created_at !== String(latest.when)
	)
		throw new Error(
			`deployed database is behind the journal: ${JSON.stringify(result.rows[0])}`,
		);
} finally {
	await deployed.end();
}

try {
	psql(`CREATE DATABASE ${database}`);
	drizzle(["migrate"], { env: { ...process.env, DATABASE_URL: url.href } });
	const client = new pg.Client({ connectionString: url.href });
	await client.connect();
	try {
		const migrations = await client.query(
			"select hash, created_at::text from drizzle.__drizzle_migrations order by id",
		);
		const expectedLedger = journal.entries.map(({ tag, when }) => ({
			hash: createHash("sha256")
				.update(readFileSync(new URL(`${tag}.sql`, migrationsUrl)))
				.digest("hex"),
			created_at: String(when),
		}));
		if (JSON.stringify(migrations.rows) !== JSON.stringify(expectedLedger))
			throw new Error(
				`unexpected migration ledger: ${JSON.stringify(migrations.rows)}`,
			);
		const constraints = await client.query(
			"select conname from pg_constraint where conname = any($1::text[])",
			[
				[
					"tickets_subcategory_service_fk",
					"tickets_merged_into_fk",
					"services_sla_id_fkey",
					"services_ola_id_fkey",
					"service_subcategories_form_id_fkey",
				],
			],
		);
		if (constraints.rowCount !== 5)
			throw new Error(
				`missing reconciled constraints: ${JSON.stringify(constraints.rows)}`,
			);
		const referenceData = await client.query(`select
			(select count(*)::int from pending_reasons) pending_reasons,
			(select count(*)::int from sla_notification_rules) sla_notification_rules,
			(select count(*)::int from ticket_origins) ticket_origins,
			(select count(*)::int from email_templates) email_templates,
			(select count(*)::int from forms where id = 'form-laptop-request') laptop_forms,
			(select count(*)::int from services where id = 'svc-device' and sla_id = 'device-service-sla') device_slas,
			(select count(*)::int from ticket_rules where id = 'starter-device-human-triage') starter_rules,
			(select count(*)::int from cmdb_relationship_types where impact_direction <> 'none') relationship_types,
			(select count(*)::int from cmdb_class_properties where spreads_impact) impact_properties`);
		if (Object.values(referenceData.rows[0]).some((count) => count === 0))
			throw new Error(
				`missing migration effects: ${JSON.stringify(referenceData.rows[0])}`,
			);
	} finally {
		await client.end();
	}
	console.log(
		`Clean ${journal.entries.length}-migration snapshot baseline is valid.`,
	);
} finally {
	psql(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
}
