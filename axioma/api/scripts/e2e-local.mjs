#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
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
	[
		"11",
		"Intake — draft lifecycle",
		"Requires intake drafts with ticket re-parent and public transcript",
	],
	[
		"11b",
		"Intake — live draft to ticket",
		"Requires AXIOMA_LLM_KEY and a running API",
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

const connectionString = () =>
	process.env.DATABASE_URL ??
	"postgresql://postgres:password@localhost:5432/axioma";

// A 1x1 red PNG, valid and tiny. The blob store is content-addressed, so every
// run of this leg re-uses the same object rather than growing the store.
const INTAKE_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64",
);

/**
 * `sendIntakeMessage` answers with an oRPC event iterator, which reaches this
 * script as a text blob rather than a parsed stream. Every payload line is
 * tried as JSON so the leg can assert on the terminal `complete` event instead
 * of only substring-matching the wire. Both handler encodings are accepted:
 * the OpenAPI handler writes the event itself, the RPC one wraps it as
 * `{json, meta}`.
 */
function parseIntakeEvents(stream) {
	const events = [];
	for (const rawLine of stream.split(/\r?\n/)) {
		const line = rawLine.startsWith("data:")
			? rawLine.slice(5).trim()
			: rawLine.trim();
		if (!line.startsWith("{")) continue;
		let payload;
		try {
			payload = JSON.parse(line);
		} catch {
			continue;
		}
		const event =
			payload && typeof payload.type !== "string" && payload.json
				? payload.json
				: payload;
		if (event && typeof event.type === "string") events.push(event);
	}
	return events;
}

/**
 * The only leg that writes. It drives the deployed API over HTTP with a
 * short-lived API key holding nothing but `ticket.create`, then verifies the
 * four things intake is responsible for: a drafted incident, the ticket, the
 * re-parented attachment, and the transcript. It runs on its own connection,
 * outside the read-only transaction the rest of the run shares.
 */
async function intakeLifecycle() {
	const scenario = "11b";
	const name = "Intake live draft to ticket";
	if (!process.env.AXIOMA_LLM_KEY)
		return result(
			scenario,
			name,
			"skipped",
			"Intake drafting needs a live model",
			"Set AXIOMA_LLM_KEY and re-run",
		);

	const suffix = randomUUID();
	const reporterId = `e2e-intake-${suffix}`;
	const writer = new Client({
		connectionString: connectionString(),
		application_name: "axioma-e2e-local-intake",
	});
	const ticketIds = [];
	const documentIds = [];
	try {
		await writer.connect();
		const prefix = randomBytes(9).toString("base64url");
		const secret = randomBytes(32).toString("base64url");
		await writer.query(
			'insert into "user" (id, name, email) values ($1, $2, $3)',
			[reporterId, "E2E intake reporter", `${reporterId}@example.test`],
		);
		// A real account is given the Employee role at sign-up, and an API key's
		// capabilities are intersected with what its owner still holds — so a
		// roleless fixture is refused at the door rather than reaching the
		// procedure it is meant to exercise.
		await writer.query(
			"insert into user_roles (user_id, role_id) values ($1, 'employee')",
			[reporterId],
		);
		// `ticket.create` alone: the document writer treats anyone holding
		// `ticket.read.all` as an analyst and refuses a draft target.
		await writer.query(
			`insert into api_keys (id, user_id, name, prefix, secret_hash, capabilities, expires_at)
			values ($1, $2, $3, $4, $5, $6::jsonb, now() + interval '1 hour')`,
			[
				randomUUID(),
				reporterId,
				"e2e intake",
				prefix,
				`sha256:${createHash("sha256").update(secret).digest("hex")}`,
				JSON.stringify(["ticket.create"]),
			],
		);
		const token = `axk_${prefix}.${secret}`;

		const call = async (procedure, body) => {
			const response = await fetch(`${apiUrl}/api-reference/${procedure}`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(120_000),
			});
			const text = await response.text();
			if (!response.ok)
				throw new Error(
					`${procedure} returned HTTP ${response.status} ${text.slice(0, 200)}`,
				);
			return text;
		};

		const draft = JSON.parse(await call("startIntakeDraft", {}));
		if (!draft?.id) throw new Error("startIntakeDraft returned no draft id");

		const form = new FormData();
		form.append("targetType", "draft");
		form.append("targetId", draft.id);
		form.append(
			"file",
			new File([INTAKE_PNG], "intake-e2e.png", { type: "image/png" }),
		);
		const upload = await fetch(`${apiUrl}/api/documents`, {
			method: "POST",
			headers: { Authorization: `Bearer ${token}` },
			body: form,
			signal: AbortSignal.timeout(30_000),
		});
		const uploadBody = await upload.text();
		if (!upload.ok)
			throw new Error(
				`document upload returned HTTP ${upload.status} ${uploadBody.slice(0, 200)}`,
			);
		const document = JSON.parse(uploadBody);
		documentIds.push(document.id);

		const stream = await call("sendIntakeMessage", {
			draftId: draft.id,
			body: "Outlook will not open on my laptop and reports a broken profile.",
			excludedAttachments: [],
		});
		if (stream.includes('"type":"error"'))
			throw new Error(`intake stream reported ${stream.slice(0, 200)}`);
		if (!stream.includes('"type":"complete"'))
			throw new Error("intake stream ended without a complete event");

		// A stream that merely completes proves transport, not drafting: an empty
		// or garbage draft would still be overwritten by the patch below and pass.
		// So the terminal event is parsed and the drafting path asserted first.
		// Shape and intent only — the model's exact wording is not what this leg
		// proves, and asserting it would make the leg a model-wording test.
		const events = parseIntakeEvents(stream);
		const completed = events.findLast((event) => event.type === "complete");
		if (!completed)
			throw new Error(
				`intake stream carried a complete event but it could not be parsed (${events.length} events read from ${stream.length} bytes). This is a wire-format change in the event iterator, not a model failure`,
			);
		const drafted = completed.draft ?? {};
		const draftedValues = drafted.values ?? {};
		const draftedSources = drafted.fieldSources ?? {};
		const draftedTitle =
			typeof draftedValues.title === "string" ? draftedValues.title.trim() : "";
		if (drafted.intent !== "incident")
			throw new Error(
				`drafting classified intent=${JSON.stringify(drafted.intent)}, expected "incident" — "Outlook will not open" is unambiguously an incident, so either the model regressed or classification is not reaching the draft`,
			);
		if (draftedTitle === "")
			throw new Error(
				`drafting produced no title: values.title=${JSON.stringify(draftedValues.title)} — either the model returned a low-confidence/blank draft or drafted values are not being persisted`,
			);
		if (draftedSources.title !== "ai")
			throw new Error(
				`drafted title is attributed to fieldSources.title=${JSON.stringify(draftedSources.title)}, expected "ai" — nothing has edited the draft yet, so this is field-source bookkeeping, not the model`,
			);

		// The model's wording is not what this leg proves, so the two bounded
		// fields are set explicitly and the submit path is measured on its own.
		await call("patchIntakeDraft", {
			draftId: draft.id,
			values: {
				title: "Outlook will not open",
				body: "Outlook fails to start and reports a broken profile.",
			},
			sources: { title: "user", body: "user" },
		});
		const submitted = JSON.parse(
			await call("submitIntakeDraft", {
				draftId: draft.id,
				idempotencyKey: randomUUID(),
			}),
		);
		if (!submitted?.ticketId)
			throw new Error("submitIntakeDraft returned no ticket id");
		ticketIds.push(submitted.ticketId);

		const r = (
			await writer.query(
				`select
				(select count(*)::int from tickets where id = $1) tickets,
				(select count(*)::int from document_links where document_id = $2 and target_type = 'ticket' and target_id = $1) reparented,
				(select count(*)::int from document_links where document_id = $2 and target_type = 'draft') stranded,
				(select count(*)::int from ticket_messages where ticket_id = $1 and visibility = 'public' and body like 'Employee:%') transcripts,
				(select count(*)::int from ticket_drafts where id = $3 and status = 'submitted' and ticket_id = $1) submitted_drafts`,
				[submitted.ticketId, document.id, draft.id],
			)
		).rows[0];
		const ok =
			r.tickets === 1 &&
			r.reparented === 1 &&
			r.stranded === 0 &&
			r.transcripts === 1 &&
			r.submitted_drafts === 1;
		return result(
			scenario,
			name,
			ok ? "ran" : "failed",
			`drafted_intent=${drafted.intent}, drafted_title_source=${draftedSources.title}, tickets=${r.tickets}, reparented_links=${r.reparented}, stranded_draft_links=${r.stranded}, transcript_messages=${r.transcripts}, submitted_drafts=${r.submitted_drafts}`,
			ok
				? null
				: "Submit did not land the ticket, the re-parented attachment, and one transcript",
		);
	} catch (error) {
		return result(
			scenario,
			name,
			"failed",
			"Intake lifecycle could not complete",
			safeError(error),
		);
	} finally {
		try {
			await writer.query(
				"delete from ticket_creation_claims where reporter_id = $1",
				[reporterId],
			);
			await writer.query(
				"delete from workflow_executions where record_id = any($1::text[])",
				[ticketIds],
			);
			await writer.query(
				"delete from ticket_number_history where ticket_id = any($1::text[])",
				[ticketIds],
			);
			await writer.query("delete from tickets where id = any($1::text[])", [
				ticketIds,
			]);
			// After the tickets, so a projection written by the API's own
			// fire-and-forget indexing has nothing left to index.
			await writer.query(
				"delete from search_documents where object_id = any($1::text[])",
				[ticketIds],
			);
			await writer.query("delete from documents where id = any($1::text[])", [
				documentIds,
			]);
			await writer.query('delete from "user" where id = $1', [reporterId]);
		} catch (error) {
			if (!json) console.error(`Intake cleanup failed: ${safeError(error)}`);
		}
		await writer.end().catch(() => {});
	}
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
		connectionString: connectionString(),
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
	await check(
		"11",
		"Intake draft lifecycle",
		`select
			(select count(*)::int from information_schema.tables where table_schema='public' and table_name='ticket_drafts') has_drafts_table,
			(select count(*)::int from information_schema.columns where table_schema='public' and table_name='document_links' and column_name='target_type') has_target_type,
			(select count(*)::int from ticket_drafts) drafts
		`,
		(r) => {
			const ok = r.has_drafts_table === 1 && r.has_target_type === 1;
			return result(
				"11",
				"Intake draft lifecycle",
				ok ? "ran" : "failed",
				`has_drafts_table=${r.has_drafts_table}, has_target_type=${r.has_target_type}, drafts=${r.drafts}`,
				ok ? null : "Intake schema not migrated",
			);
		},
	);
	await client.query("rollback");
	await client.end();
}

results.push(
	client
		? await intakeLifecycle()
		: result(
				"11b",
				"Intake live draft to ticket",
				"skipped",
				"Database unavailable",
				"Start the local stack and re-run",
			),
);

const completedResults = completeScenarios(results);

const generatedAt = new Date().toISOString();
const run = {
	generatedAt,
	summary: summarize(completedResults),
	results: completedResults,
};
const stamp = generatedAt.replaceAll(":", "-").replace(".", "-");
// Resolved from this file rather than from the working directory: run from
// anywhere but api/ and a cwd-relative "../../temp/results" lands outside
// the checkout.
const resultsDir = fileURLToPath(
	new URL("../../../temp/results/", import.meta.url),
);
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
