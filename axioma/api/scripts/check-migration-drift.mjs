import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	cpSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const database = `axioma_drift_${process.pid}`;
const serverUrl =
	process.env.DATABASE_URL ??
	"postgresql://postgres:password@localhost:5432/axioma";
const url = new URL(serverUrl);
url.pathname = `/${database}`;
const run = (command, args, options = {}) =>
	execFileSync(command, args, { encoding: "utf8", stdio: "pipe", ...options });
// Resolved through the package root because drizzle-kit does not export
// ./bin.cjs, and spawned directly so the script does not depend on being run
// through a package manager.
const drizzleKitBin = join(
	dirname(createRequire(import.meta.url).resolve("drizzle-kit")),
	"bin.cjs",
);
const drizzle = (args, options = {}) =>
	run(process.execPath, [drizzleKitBin, ...args], options);
// The scratch database is created and dropped on the same server everything
// else here connects to. Shelling out to a named Compose container created it
// in one server and connected to it in another the moment DATABASE_URL pointed
// anywhere but the local container — a CI service container, for one. `postgres`
// is the maintenance database: CREATE DATABASE cannot run from inside the
// database it is creating a sibling of.
const maintenanceUrl = new URL(serverUrl);
maintenanceUrl.pathname = "/postgres";
const maintenance = async (sql) => {
	const client = new pg.Client({ connectionString: maintenanceUrl.href });
	await client.connect();
	try {
		await client.query(sql);
	} finally {
		await client.end();
	}
};

const migrationsUrl = new URL("../src/db/migrations/", import.meta.url);
const hashOf = (tag) =>
	createHash("sha256")
		.update(readFileSync(new URL(`${tag}.sql`, migrationsUrl)))
		.digest("hex");
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

// A hand-written migration that never refreshes the snapshot leaves the tip
// describing an older schema than the ledger builds. Every later
// `drizzle-kit generate` diffs against that stale tip, so it re-emits objects
// the ledger already created, or dies on a create-vs-rename prompt it cannot
// ask for in CI. The journal and the prevId chain both stay valid throughout,
// which is why this needs its own check: pin the tip to the journal, then
// prove the tip still describes the schema.
const tip = snapshots.at(-1);
if (!tip) throw new Error("migration snapshots are missing");
if (Number(tip.name.slice(0, 4)) !== latest.idx)
	throw new Error(
		`tip snapshot ${tip.name} does not cover journal entry ${latest.idx} (${latest.tag}); refresh it with pnpm db:generate`,
	);

const apiDir = fileURLToPath(new URL("../", import.meta.url));
const probeName = `drizzle-drift-${process.pid}`;
const probeOut = `./node_modules/.cache/${probeName}/migrations`;
const probeDir = fileURLToPath(
	new URL(`../node_modules/.cache/${probeName}/`, import.meta.url),
);
const probeConfig = `${probeDir}drizzle.config.ts`;
mkdirSync(probeDir, { recursive: true });
// A bare object rather than defineConfig: nothing to resolve from wherever the
// cache directory happens to sit.
writeFileSync(
	probeConfig,
	`export default ${JSON.stringify({
		schema: "./src/db/schema",
		out: probeOut,
		dialect: "postgresql",
	})};
`,
);
cpSync(fileURLToPath(migrationsUrl), `${probeDir}migrations`, {
	recursive: true,
});
try {
	// generate writes into the throwaway copy, never into src/db/migrations.
	const generated = drizzle(["generate", `--config=${probeConfig}`], {
		cwd: apiDir,
	});
	if (!generated.includes("No schema changes"))
		throw new Error(
			`schema has drifted from ${tip.name}; run pnpm db:generate and commit the result:
${generated}`,
		);
} catch (error) {
	// A drifted tip makes drizzle-kit ask create-vs-rename, which it cannot do
	// without a TTY, so that prompt surfaces here as a spawn failure rather
	// than as generated SQL.
	if (error instanceof Error && "stdout" in error)
		throw new Error(
			`drizzle-kit generate failed against ${tip.name}:
${error.stdout}${error.stderr ?? ""}`,
		);
	throw error;
} finally {
	rmSync(probeDir, { recursive: true, force: true });
}

const deployed = new pg.Client({ connectionString: serverUrl });
await deployed.connect();
try {
	const applied = await deployed.query(
		"select created_at::text, hash from drizzle.__drizzle_migrations order by id",
	);
	// Matched on `when` rather than counted: an entry pruned from the journal
	// after it was applied stays in every deployed ledger for good, so a row
	// count would read that as drift forever.
	const appliedHashes = new Map(
		applied.rows.map(({ created_at, hash }) => [created_at, hash]),
	);
	const behind = journal.entries.filter(
		({ when }) => !appliedHashes.has(String(when)),
	);
	if (behind.length)
		throw new Error(
			`deployed database is behind the journal: ${behind.map(({ tag }) => tag).join(", ")}`,
		);
	// Editing an applied migration diverges every database that already ran it
	// from the one a clean replay builds, and leaves no other trace: the
	// journal, the snapshot chain and the replayed ledger all still agree.
	const edited = journal.entries.filter(
		({ tag, when }) => appliedHashes.get(String(when)) !== hashOf(tag),
	);
	if (edited.length)
		throw new Error(
			`edited after the deployed database applied them, so it no longer matches a clean replay: ${edited.map(({ tag }) => tag).join(", ")}`,
		);
} finally {
	await deployed.end();
}

try {
	await maintenance(`CREATE DATABASE ${database}`);
	// cwd, like the generate call above: drizzle-kit resolves drizzle.config.ts
	// from the working directory, so without it this only runs from api/.
	drizzle(["migrate"], {
		cwd: apiDir,
		env: { ...process.env, DATABASE_URL: url.href },
	});
	const client = new pg.Client({ connectionString: url.href });
	await client.connect();
	try {
		const migrations = await client.query(
			"select hash, created_at::text from drizzle.__drizzle_migrations order by id",
		);
		const expectedLedger = journal.entries.map(({ tag, when }) => ({
			hash: hashOf(tag),
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
	await maintenance(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
}
