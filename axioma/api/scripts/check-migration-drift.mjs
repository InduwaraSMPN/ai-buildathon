import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";

const database = `axioma_drift_${process.pid}`;
const url = `postgresql://postgres:password@localhost:5432/${database}`;
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

const journal = JSON.parse(
	readFileSync(
		new URL("../src/db/migrations/meta/_journal.json", import.meta.url),
	),
);
const latest = journal.entries.at(-1);
if (!latest) throw new Error("migration journal is empty");
if (
	!journal.entries.some(({ idx }) => {
		try {
			readFileSync(
				new URL(
					`../src/db/migrations/meta/${String(idx).padStart(4, "0")}_snapshot.json`,
					import.meta.url,
				),
			);
			return true;
		} catch {
			return false;
		}
	})
)
	throw new Error("migration snapshots are missing");

try {
	psql(`CREATE DATABASE ${database}`);
	drizzle(["migrate"], { env: { ...process.env, DATABASE_URL: url } });
	const client = new pg.Client({ connectionString: url });
	await client.connect();
	try {
		const migrations = await client.query(
			"select count(*)::int count, max(created_at)::text latest from drizzle.__drizzle_migrations",
		);
		if (
			migrations.rows[0].count !== journal.entries.length ||
			migrations.rows[0].latest !==
				String(Math.max(...journal.entries.map(({ when }) => when)))
		)
			throw new Error(
				`unexpected migration ledger: ${JSON.stringify(migrations.rows[0])}`,
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
	} finally {
		await client.end();
	}
	console.log(
		`Clean ${journal.entries.length}-migration snapshot baseline is valid.`,
	);
} finally {
	psql(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
}
