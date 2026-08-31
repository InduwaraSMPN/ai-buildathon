#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const args = new Set(process.argv.slice(2));
const valueArg = (name) => {
	const prefix = `${name}=`;
	return process.argv
		.slice(2)
		.find((arg) => arg.startsWith(prefix))
		?.slice(prefix.length);
};
const json = args.has("--json");
const allowSkips = args.has("--allow-skips");
const reportPath = valueArg("--report");
const apiUrl = valueArg("--api-url") ?? "http://localhost:3000";
const portalUrl = valueArg("--portal-url") ?? "http://localhost:3001";
const dashboardUrl = valueArg("--dashboard-url") ?? "http://localhost:3002";

const scenarios = [
	["0", "Smoke — stack alive", "Start the complete local stack and seed data"],
	[
		"1a",
		"Default environment resolution",
		"Run a ticket with no environment link",
	],
	[
		"1b",
		"Ticket environment beats default",
		"Run a ticket explicitly scoped to staging",
	],
	[
		"1c",
		"Foreign environment refused",
		"Run a ticket linked outside its service allowlist",
	],
	[
		"1d",
		"Shadow mode refuses writes",
		"Requires kind and a shadow-mode write attempt",
	],
	[
		"2a-lexical",
		"Forced lexical retrieval and citation",
		"Run a matching ticket and inspect its transcript",
	],
	[
		"2a-hybrid",
		"Hybrid retrieval and citation",
		"Requires AXIOMA_LLM_KEY and embedding backfill",
	],
	[
		"2b",
		"Retrieval degradation",
		"Restart without AXIOMA_LLM_KEY and run a ticket",
	],
	["2c", "Reporter context", "Run tickets with and without directory records"],
	[
		"2d",
		"Cross-employee de-identification",
		"Run the two-employee retrieval scenario to verify transcript redaction",
	],
	[
		"2e",
		"Raw ticket corpus exclusion",
		"Run and inspect a transcript to prove raw tickets were not cited",
	],
	[
		"2f",
		"CMDB resolution gate",
		"Run a fixing scenario to create an observation",
	],
	[
		"3",
		"Infrastructure fix",
		"Requires kind, AXIOMA_LLM_KEY, and an interactive ticket run",
	],
	[
		"3b",
		"Narrow cluster write surface",
		"Requires kind and an intentionally unsupported write request",
	],
	[
		"4",
		"Correct refusal",
		"Requires kind, AXIOMA_LLM_KEY, and transcript/cluster inspection",
	],
	[
		"5a",
		"Device enrolment and stored hash",
		"Requires a real Windows device and TLS gateway",
	],
	[
		"5b",
		"Single-use enrolment token",
		"Requires a real Windows device and consumed token",
	],
	[
		"5c",
		"Expired enrolment token refused",
		"Requires a real Windows device and expired token",
	],
	["5d", "Device impersonation refused", "Requires a TLS gRPC scratch client"],
	[
		"5e",
		"TLS cannot be bypassed",
		"Requires a real Windows device and test certificates",
	],
	["5f", "Device revocation", "Requires a connected real Windows device"],
	["5g", "Credential rotation", "Requires a connected real Windows device"],
	[
		"6",
		"Typed device action",
		"Requires a real Windows device with the seeded fault",
	],
	[
		"6b",
		"Device sleep and replay",
		"Requires suspending a real Windows device mid-run",
	],
	[
		"7",
		"UI Automation device action",
		"Requires a real Windows device and accessible test application",
	],
	[
		"7b",
		"Pixel fallback refusal",
		"Requires a real Windows device and interactive run",
	],
	[
		"8a",
		"Command proposal default off",
		"Requires a real Windows device and interactive run",
	],
	[
		"8b",
		"Proposal approval and dispatch",
		"Requires a real Windows device and approver",
	],
	[
		"8c",
		"Proposal separation of duty",
		"Requires a second account with device.approve",
	],
	["8d", "Proposal single use", "Requires an approved and dispatched proposal"],
	["8e", "Proposal digest binding", "Run scenario 8 to create proposal rows"],
	["8f", "Proposal expiry", "Requires waiting for the scheduled expiry sweep"],
	[
		"8g",
		"Ticket command injection containment",
		"Requires a real Windows device and adversarial ticket",
	],
	["9", "ITSM connector", "Requires a ServiceNow instance or compatible stub"],
	[
		"10",
		"Deployment",
		"Requires a clean kind cluster and deployment credentials",
	],
	["exit-gates", "Project exit gates", "Run every project gate separately"],
];

export function completeScenarios(results) {
	return scenarios.map(
		([id, name, blocker]) =>
			results.find((item) => String(item.scenario) === id) ??
			result(
				id,
				name,
				"skipped",
				"Not safely verified by this read-only run",
				blocker,
			),
	);
}

export function summarize(results) {
	const totals = { ran: 0, skipped: 0, failed: 0 };
	for (const item of results) totals[item.status]++;
	return totals;
}

export function exitCode(summary, allowSkips = false) {
	return summary.failed > 0 ? 1 : summary.skipped > 0 && !allowSkips ? 2 : 0;
}

export function safeError(error) {
	return (error instanceof Error ? error.message : String(error))
		.replace(
			/postgres(?:ql)?:\/\/[^\s/@]+(?::[^\s/@]*)?@/gi,
			"postgresql://[redacted]@",
		)
		.replace(
			/(password|secret|token|credential|key)=([^\s&]+)/gi,
			"$1=[redacted]",
		);
}

function result(scenario, name, status, evidence, blocker = null) {
	return { scenario, name, status, evidence, blocker };
}

function markdown(run) {
	const rows = run.results.map(
		(item) =>
			`| ${item.scenario} | ${item.name.replaceAll("|", "\\|")} | ${item.status} | ${item.evidence.replaceAll("|", "\\|")} | ${(item.blocker ?? "").replaceAll("|", "\\|")} |`,
	);
	return `# Local E2E verification\n\nGenerated: ${run.generatedAt}\n\n| Scenario | Check | Status | Evidence | Blocker |\n|---:|---|---|---|---|\n${rows.join("\n")}\n\nRan: ${run.summary.ran}; skipped: ${run.summary.skipped}; failed: ${run.summary.failed}.\n`;
}

async function reachable(url, expectJson = false) {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(5_000),
		redirect: "manual",
	});
	if (!response.ok && !(response.status >= 300 && response.status < 400))
		throw new Error(`HTTP ${response.status}`);
	if (expectJson) {
		const body = await response.json();
		if (body?.status !== "ok") throw new Error("health response was not ok");
	}
	return `HTTP ${response.status}`;
}

async function selfTest() {
	assert.deepEqual(
		summarize([
			{ status: "ran" },
			{ status: "skipped" },
			{ status: "failed" },
			{ status: "ran" },
		]),
		{ ran: 2, skipped: 1, failed: 1 },
	);
	assert.deepEqual(
		completeScenarios([result("0", "smoke", "ran", "ok")]).map((item) =>
			String(item.scenario),
		),
		scenarios.map(([id]) => id),
	);
	assert.equal(exitCode({ ran: 1, skipped: 1, failed: 0 }), 2);
	assert.equal(exitCode({ ran: 1, skipped: 1, failed: 0 }, true), 0);
	assert.equal(exitCode({ ran: 1, skipped: 0, failed: 1 }, true), 1);
	assert.equal(
		safeError(new Error("postgresql://user:hunter2@localhost/db")),
		"postgresql://[redacted]@localhost/db",
	);
	assert.match(
		markdown({
			generatedAt: "now",
			results: [result(0, "a", "ran", "ok")],
			summary: { ran: 1, skipped: 0, failed: 0 },
		}),
		/\| 0 \| a \| ran \|/,
	);
	console.log("e2e-local self-test passed");
}

if (args.has("--self-test")) {
	await selfTest();
	process.exit(0);
}

if (!args.has("--run")) {
	console.error(
		"Opt-in only. Run `pnpm e2e:local -- --run` (optional: --json, --allow-skips, --report=PATH).",
	);
	process.exit(2);
}

const results = [];
let client;
try {
	const web = await Promise.all([
		reachable(`${apiUrl}/health`, true),
		reachable(portalUrl),
		reachable(dashboardUrl),
	]);
	results.push(
		result(
			0,
			"Smoke and baseline",
			"ran",
			`API, portal, dashboard reachable (${web.join(", ")})`,
		),
	);
} catch (error) {
	results.push(
		result(
			0,
			"Smoke and baseline",
			"failed",
			"One or more HTTP surfaces were unreachable",
			safeError(error),
		),
	);
}

try {
	client = new Client({
		connectionString:
			process.env.DATABASE_URL ??
			"postgresql://postgres:password@localhost:5432/axioma",
		application_name: "axioma-e2e-local-read-only",
	});
	await client.connect();
	await client.query("begin read only");
} catch (error) {
	if (client) await client.end().catch(() => {});
	client = undefined;
	if (results[0].status === "ran")
		results[0] = result(
			0,
			"Smoke and baseline",
			"failed",
			results[0].evidence,
			"Database unavailable",
		);
	if (!json) console.error(`Database unavailable: ${safeError(error)}`);
}

const query = async (text) => (await client.query(text)).rows[0];
const check = async (scenario, name, sql, assess) => {
	try {
		const row = await query(sql);
		results.push(assess(row));
	} catch (error) {
		results.push(
			result(
				scenario,
				name,
				"failed",
				"Query could not complete",
				safeError(error),
			),
		);
	}
};

if (client) {
	try {
		const r = await query(`select
			(select count(*)::int from environments) environments,
			(select count(*)::int from service_environments) service_links,
			(select count(*)::int from tickets) tickets,
			(select count(*)::int from devices) devices,
			(select count(*)::int from search_documents) projections,
			(select count(embedding)::int from search_documents) embedded`);
		const healthy = r.environments > 0 && r.service_links > 0 && r.tickets > 0;
		results[0].evidence += `; environments=${r.environments}, service_links=${r.service_links}, tickets=${r.tickets}, devices=${r.devices}, projections=${r.projections}, embedded=${r.embedded}`;
		if (!healthy) {
			results[0].status = "failed";
			results[0].blocker = "Required seeded baseline rows are absent";
		}
	} catch (error) {
		results[0].status = "failed";
		results[0].blocker = safeError(error);
	}
	await check(
		"1a",
		"Default environment resolution configuration",
		`select count(*)::int total,
		count(*) filter (where is_default)::int defaults,
		count(*) filter (where mode = 'shadow')::int shadows,
		count(*) filter (where mode not in ('act','shadow'))::int invalid_modes
		from environments`,
		(r) => {
			const ok = r.total > 0 && r.defaults === 1 && r.invalid_modes === 0;
			return result(
				"1a",
				"Default environment resolution configuration",
				ok ? "ran" : "failed",
				`total=${r.total}, defaults=${r.defaults}, invalid_modes=${r.invalid_modes}`,
				ok ? null : "Expected exactly one default and only known modes",
			);
		},
	);
	await check(
		"1d",
		"Shadow environment configuration",
		"select count(*) filter (where mode = 'shadow')::int shadows from environments",
		(r) =>
			result(
				"1d",
				"Shadow environment configuration",
				r.shadows > 0 ? "ran" : "failed",
				`shadow_environments=${r.shadows}`,
				r.shadows > 0 ? null : "No shadow-mode environment is configured",
			),
	);
	await check(
		"2d",
		"De-identified resolved titles",
		`select
		count(*) filter (where object_type = 'ticket')::int raw_tickets,
		count(*) filter (where object_type = 'resolved_ticket')::int resolved,
		count(*) filter (where object_type = 'resolved_ticket' and title <> 'De-identified resolved ticket')::int bad_titles
		from search_documents`,
		(r) =>
			result(
				"2d",
				"De-identified resolved titles",
				r.bad_titles === 0 ? "ran" : "failed",
				`resolved_projections=${r.resolved}, bad_resolved_titles=${r.bad_titles}`,
				r.bad_titles === 0 ? null : "A resolved title is not de-identified",
			),
	);
	await check(
		"2e",
		"Raw ticket projection presence",
		"select count(*)::int raw_tickets from search_documents where object_type = 'ticket'",
		(r) =>
			result(
				"2e",
				"Raw ticket projection presence",
				r.raw_tickets > 0 ? "ran" : "failed",
				`raw_ticket_projections=${r.raw_tickets}`,
				r.raw_tickets > 0 ? null : "Raw ticket projections are absent",
			),
	);
	await check(
		"2f",
		"CMDB observation provenance",
		`select
		count(*) filter (where source_ticket_id is not null or source_run_id is not null or source_step_id is not null)::int observed,
		count(*) filter (where (source_ticket_id is not null or source_run_id is not null or source_step_id is not null)
			and (source_ticket_id is null or source_run_id is null or source_step_id is null or observed_at is null))::int incomplete
		from cmdb_objects`,
		(r) =>
			r.observed === 0
				? result(
						"2f",
						"CMDB observation provenance",
						"skipped",
						"No run-produced CMDB observations exist",
						"Run an infrastructure scenario first",
					)
				: result(
						"2f",
						"CMDB observation provenance",
						r.incomplete === 0 ? "ran" : "failed",
						`observations=${r.observed}, incomplete=${r.incomplete}`,
						r.incomplete === 0
							? null
							: "A run-produced CMDB observation lacks provenance",
					),
	);
	await check(
		"5a",
		"Credential schema and hashes",
		`select
		(select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'devices' and column_name in ('credential','token','password','secret')) plaintext_columns,
		(select count(*)::int from devices where credential_hash is not null and credential_hash !~ '^[0-9a-f]{64}$') bad_device_hashes,
		(select count(*)::int from device_enrolment_tokens where token_hash !~ '^[0-9a-f]{64}$') bad_token_hashes,
		(select count(*)::int from devices where credential_hash is not null) hashed_devices`,
		(r) => {
			const ok =
				r.plaintext_columns === 0 &&
				r.bad_device_hashes === 0 &&
				r.bad_token_hashes === 0;
			return result(
				"5a",
				"Credential schema and hashes",
				ok ? "ran" : "failed",
				`plaintext_secret_columns=${r.plaintext_columns}, hashed_devices=${r.hashed_devices}, malformed_device_hashes=${r.bad_device_hashes}, malformed_token_hashes=${r.bad_token_hashes}`,
				ok
					? null
					: "Plaintext credential schema or malformed SHA-256 hash found",
			);
		},
	);
	await check(
		"8e",
		"Proposal digest and provenance",
		`select count(*)::int proposals,
		count(*) filter (where digest !~ '^[0-9a-f]{64}$' or device_id is null or ticket_id is null)::int invalid,
		count(*) filter (where dispatched_command_id is not null and not exists (
			select 1 from device_commands c where c.id = device_command_proposals.dispatched_command_id and c.proposal_id = device_command_proposals.id))::int broken_dispatch_links
		from device_command_proposals`,
		(r) =>
			r.proposals === 0
				? result(
						"8e",
						"Proposal digest and provenance",
						"skipped",
						"No command proposal rows exist",
						"Run scenario 8 first",
					)
				: result(
						"8e",
						"Proposal digest and provenance",
						r.invalid === 0 && r.broken_dispatch_links === 0 ? "ran" : "failed",
						`proposals=${r.proposals}, invalid=${r.invalid}, broken_dispatch_links=${r.broken_dispatch_links}`,
						r.invalid === 0 && r.broken_dispatch_links === 0
							? null
							: "A proposal lacks a SHA-256 digest/provenance or has a broken dispatch link",
					),
	);
	await check(
		"9",
		"ITSM dispatch ledger uniqueness",
		`select count(*)::int ledger_rows,
		(select count(*)::int from (select ticket_id, trigger_key from itsm_dispatch_ledger group by 1,2 having count(*) > 1) d) duplicates
		from itsm_dispatch_ledger`,
		(r) =>
			r.ledger_rows === 0
				? result(
						"9",
						"ITSM dispatch ledger uniqueness",
						"skipped",
						"No ITSM dispatch ledger rows exist",
						"Run scenario 9 first",
					)
				: result(
						"9",
						"ITSM dispatch ledger uniqueness",
						r.duplicates === 0 ? "ran" : "failed",
						`ledger_rows=${r.ledger_rows}, duplicate_ticket_triggers=${r.duplicates}`,
						r.duplicates === 0
							? null
							: "Duplicate ticket/trigger dispatch ledger rows exist",
					),
	);
	await client.query("rollback");
	await client.end();
}

const completedResults = completeScenarios(results);

const generatedAt = new Date().toISOString();
const run = {
	generatedAt,
	summary: summarize(completedResults),
	results: completedResults,
};
const stamp = generatedAt.replaceAll(":", "-").replace(".", "-");
const resultsDir = join("..", "..", "temp", "results");
await mkdir(resultsDir, { recursive: true });
const jsonPath = join(resultsDir, `e2e-local-${stamp}.json`);
const markdownPath = join(resultsDir, `e2e-local-${stamp}.md`);
await Promise.all([
	writeFile(jsonPath, `${JSON.stringify(run, null, 2)}\n`, "utf8"),
	writeFile(markdownPath, markdown(run), "utf8"),
]);
if (reportPath) {
	await mkdir(dirname(reportPath), { recursive: true });
	await writeFile(reportPath, markdown(run), "utf8");
}
if (json)
	console.log(
		JSON.stringify({ ...run, reports: [jsonPath, markdownPath] }, null, 2),
	);
else {
	for (const item of completedResults)
		console.log(
			`[${item.status.toUpperCase()}] ${item.scenario} ${item.name}: ${item.evidence}${item.blocker ? ` — ${item.blocker}` : ""}`,
		);
	console.log(
		`Ran ${run.summary.ran}; skipped ${run.summary.skipped}; failed ${run.summary.failed}; reports ${jsonPath}, ${markdownPath}${reportPath ? `, ${reportPath}` : ""}.`,
	);
}
process.exit(exitCode(run.summary, allowSkips));
