#!/usr/bin/env node
// Phase 0 gateway probe — does the intake provider accept `json_schema`
// structured output, non-strict tool calling, and `image_url` content parts?
//
// Standalone and dependency-free (node built-ins only). Run from api/:
//
//   node scripts/probe-intake-model.mjs           human-readable report
//   node scripts/probe-intake-model.mjs --check    terse, for gate runs
//
// Environment:
//   AXIOMA_LLM_API_BASE       OpenAI-compatible endpoint base (default https://llm.marketrix.io/v1)
//   AXIOMA_LLM_KEY            Bearer token
//   AXIOMA_INTAKE_MODEL       model, falls back to AXIOMA_LLM_MODEL
//   AXIOMA_INTAKE_TIMEOUT_MS  per-request timeout in ms (default 45000)
//
// The timeout reads the same variable the server does (src/env.ts
// `AXIOMA_INTAKE_TIMEOUT_MS`, applied in src/server/intake/model.ts), so a
// tuned intake timeout is the one the probe measures against.
//
// Exits non-zero if any critical check fails.
import process from "node:process";
import "dotenv/config";

const USAGE = `Usage: node scripts/probe-intake-model.mjs [--check]

  (no flags)  Full human-readable report plus a recommendation line.
  --check     Non-interactive gate mode: same three probes, one terse
              \`id=STATUS\` line each, exit 0 only when the critical probes
              (structured-output, tool-calling) pass.
  --help,-h   Print this message.

Environment: AXIOMA_LLM_API_BASE, AXIOMA_LLM_KEY,
             AXIOMA_INTAKE_MODEL (falls back to AXIOMA_LLM_MODEL),
             AXIOMA_INTAKE_TIMEOUT_MS (default 45000).`;

const argv = process.argv.slice(2);
const checkMode = argv.includes("--check");
const helpMode = argv.includes("--help") || argv.includes("-h");
// An unrecognised flag used to be silently ignored, which made a typo'd
// `--chekc` look like a passing default run.
const unknownArgs = argv.filter(
	(arg) => !["--check", "--help", "-h"].includes(arg),
);
if (unknownArgs.length > 0) {
	console.error(
		`Unknown argument${unknownArgs.length > 1 ? "s" : ""}: ${unknownArgs.join(", ")}\n`,
	);
	console.error(USAGE);
	process.exit(2);
}
if (helpMode) {
	console.log(USAGE);
	process.exit(0);
}

const CHECKS = [
	["structured-output", "Structured output (response_format json_schema)"],
	["tool-calling", "Non-strict tool-calling fallback"],
	["vision", "image_url content part (screenshot)"],
];

const apiBase = (
	process.env.AXIOMA_LLM_API_BASE ?? "https://llm.marketrix.io/v1"
).replace(/\/$/, "");
const key = process.env.AXIOMA_LLM_KEY ?? "";
const model =
	process.env.AXIOMA_INTAKE_MODEL ?? process.env.AXIOMA_LLM_MODEL ?? "";
const timeoutMs = Number(process.env.AXIOMA_INTAKE_TIMEOUT_MS ?? 45_000);

// A 1x1 red PNG, valid and tiny. Decoded from base64 so there is no file to
// ship alongside the probe.
const PNG_1X1 = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64",
);

const results = new Map(CHECKS.map(([id]) => [id, { status: "PENDING" }]));
const criticalFailures = [];

// `critical` marks a check that must pass for intake to work. Vision failing is
// expected and non-blocking: per the plan the code falls back to passing
// filenames/media-types as text and the flag stays off. Structured output and
// tool calling are the two that must not both be unavailable.
function setResult(id, ok, detail, { critical = true } = {}) {
	results.set(id, { status: ok ? "PASS" : "FAIL", detail });
	if (!ok && critical) criticalFailures.push(id);
}

async function complete(body) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	let response;
	try {
		response = await fetch(`${apiBase}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timer);
	}
	const raw = await response.text();
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${raw.slice(0, 300)}`);
	}
	return JSON.parse(raw);
}

// Non-dependency, best-effort conformance: the top-level keys named in
// `required` must be present and hold the declared primitive type.
function conforms(value, schema, _path = "$") {
	if (schema.type === "object") {
		if (typeof value !== "object" || value === null || Array.isArray(value)) {
			return false;
		}
		for (const req of schema.required ?? []) {
			if (!(req in value)) return false;
		}
		for (const [name, sub] of Object.entries(schema.properties ?? {})) {
			if (name in value && !conforms(value[name], sub, `${_path}.${name}`)) {
				return false;
			}
		}
		return true;
	}
	if (schema.type === "array") {
		if (!Array.isArray(value)) return false;
		const item = schema.items;
		return item === undefined || value.every((v) => conforms(v, item, _path));
	}
	switch (schema.type) {
		case "string":
			return typeof value === "string";
		case "number":
			return typeof value === "number";
		case "boolean":
			return typeof value === "boolean";
		case "integer":
			return Number.isInteger(value);
		case "null":
			return value === null;
		default:
			return true;
	}
}

async function probeStructuredOutput() {
	// Strict mode requires `required` to list every key in `properties`, so a
	// value the model may not know is expressed as a nullable type rather than
	// an omitted key. `nullable: true` is not a JSON Schema keyword and does not
	// make a property optional — the earlier version of this probe used both and
	// was rejected by the gateway before it could test anything.
	const schema = {
		type: "object",
		properties: {
			intent: { type: "string" },
			summary: { type: ["string", "null"] },
			impacted: { type: "boolean" },
		},
		required: ["intent", "summary", "impacted"],
		additionalProperties: false,
	};
	const body = {
		model,
		messages: [
			{
				role: "system",
				content:
					"Respond only with JSON matching the provided schema. This is a connectivity probe; give a short intent and set impacted=false.",
			},
			{ role: "user", content: "intake probe" },
		],
		response_format: {
			type: "json_schema",
			json_schema: { name: "intake_probe", schema, strict: true },
		},
		stream: false,
	};
	const completion = await complete(body);
	const content = completion.choices?.[0]?.message?.content;
	let parsed;
	try {
		parsed = JSON.parse(content);
	} catch {
		throw new Error(
			`response_format json_schema returned non-JSON content: ${String(content).slice(0, 200)}`,
		);
	}
	if (!conforms(parsed, schema)) {
		throw new Error(
			`completion did not conform to schema: ${JSON.stringify(parsed).slice(0, 200)}`,
		);
	}
	return {
		json: parsed,
		model: completion.model,
		usage: completion.usage,
	};
}

async function probeToolCalling() {
	const body = {
		model,
		messages: [
			{
				role: "system",
				content:
					"You are a connectivity probe. Do not answer the user's message. Only call the provided function with a summary string.",
			},
			{ role: "user", content: "intake probe" },
		],
		tools: [
			{
				type: "function",
				function: {
					name: "record_intent",
					description: "Stores the intent of the probe.",
					parameters: {
						type: "object",
						properties: { intent: { type: "string" } },
						required: ["intent"],
						additionalProperties: false,
					},
				},
			},
		],
		tool_choice: "auto",
		stream: false,
	};
	const completion = await complete(body);
	const message = completion.choices?.[0]?.message;
	const calls = message?.tool_calls;
	if (!Array.isArray(calls) || calls.length === 0) {
		throw new Error(
			`expected a tool call but got: ${JSON.stringify(message).slice(0, 300)}`,
		);
	}
	const args = JSON.parse(calls[0].function.arguments || "{}");
	if (typeof args.intent !== "string") {
		throw new Error(
			`tool call args did not carry an intent: ${JSON.stringify(args)}`,
		);
	}
	return { args, model: completion.model, usage: completion.usage };
}

async function probeVision() {
	const body = {
		model,
		messages: [
			{
				role: "system",
				content:
					"You inspect screenshots. Report concisely what you can read: any error text, dialog titles, or application name. If you cannot see the image, say exactly UNREADABLE.",
			},
			{
				role: "user",
				content: [
					{ type: "text", text: "What does this screenshot show?" },
					{
						type: "image_url",
						image_url: {
							url: `data:image/png;base64,${PNG_1X1.toString("base64")}`,
						},
					},
				],
			},
		],
		stream: false,
	};
	const completion = await complete(body);
	const content = completion.choices?.[0]?.message?.content;
	if (typeof content !== "string" || content.trim() === "") {
		throw new Error("image_url call returned no content");
	}
	return { content, model: completion.model, usage: completion.usage };
}

async function probeTextFallback() {
	// Documented §3.7 fallback: pass the filename and media type as text when
	// the endpoint does not accept image_url parts.
	const body = {
		model,
		messages: [
			{
				role: "system",
				content:
					"You inspect file metadata. Acknowledge that you received an uploaded file despite not seeing its pixels.",
			},
			{
				role: "user",
				content:
					"An employee attached error-dialog.png (image/png). What should the intake draft record about it?",
			},
		],
		stream: false,
	};
	const completion = await complete(body);
	const content = completion.choices?.[0]?.message?.content;
	if (typeof content !== "string" || content.trim() === "") {
		throw new Error("text fallback returned no content");
	}
	return { content, model: completion.model, usage: completion.usage };
}

// `fetch` rejects with a bare "fetch failed" and hides DNS/TLS/connection
// detail on `cause`, so an unreachable gateway would otherwise print nothing
// actionable. Walks the cause chain instead of dumping a stack.
function readableError(error) {
	const parts = [];
	let current = error;
	while (current && parts.length < 3) {
		const message = current.message ?? String(current);
		if (message && !parts.includes(message)) parts.push(message);
		current = current.cause;
	}
	return parts.join(": ") || String(error);
}

function summaryLine() {
	const fail = criticalFailures.length;
	if (fail > 0) {
		return `Recommendation: fix the failing path${criticalFailures.length > 1 ? "s" : ""} (${criticalFailures.join(", ")}). Intake will need the working mechanism wired through api/src/server/intake/model.ts and AXIOMA_INTAKE_VISION only if the vision check passed. See context/plans/ai-intake-plan.md §3.7–§3.9.`;
	}
	return "Recommendation: all required pathways work — json_schema and tool calling are both usable, and vision can be switched on via AXIOMA_INTAKE_VISION.";
}

function render() {
	console.log(
		`Probe: ${apiBase}  model=${model || "<unset, provider default>"}  timeout=${timeoutMs}ms`,
	);
	console.log("");
	for (const [id, name] of CHECKS) {
		const r = results.get(id);
		const detail = r.detail ? ` — ${r.detail}` : "";
		console.log(`[${r.status}] ${id}: ${name}${detail}`);
	}
	console.log("");
	console.log(summaryLine());
}

// --check output: one `id=STATUS` line per probe, a reason only when it failed,
// then a single verdict line. No recommendation prose — a gate reads this.
function renderCheck() {
	for (const [id] of CHECKS) {
		const r = results.get(id);
		const reason =
			r.status === "PASS" || !r.detail
				? ""
				: ` ${r.detail.replace(/\s+/g, " ").slice(0, 160)}`;
		console.log(`${id}=${r.status}${reason}`);
	}
	console.log(
		`probe=${criticalFailures.length > 0 ? "FAIL" : "PASS"} model=${model} endpoint=${apiBase} timeout_ms=${timeoutMs}`,
	);
}

// Exit 2 is reserved for "not configured" so a gate can tell that apart from
// exit 1, "the gateway cannot do what intake needs".
function fatal(message) {
	console.error(checkMode ? `probe=UNCONFIGURED ${message}` : message);
	process.exit(2);
}

async function runProbe(id, probe, describe, { critical = true } = {}) {
	try {
		setResult(id, true, describe(await probe()), { critical });
		return true;
	} catch (error) {
		// The default run keeps its abort-on-first-critical-failure behaviour;
		// --check reports every probe before exiting non-zero.
		if (critical && !checkMode) throw error;
		setResult(id, false, readableError(error), { critical });
		return false;
	}
}

async function main() {
	if (!key)
		fatal("AXIOMA_LLM_KEY is not set. Export it before running the probe.");
	if (!model)
		fatal(
			"Neither AXIOMA_INTAKE_MODEL nor AXIOMA_LLM_MODEL is set. A model must be named for a meaningful probe.",
		);

	await runProbe(
		"structured-output",
		probeStructuredOutput,
		(structured) =>
			`schema-conformant JSON → ${JSON.stringify(structured.json)}`,
	);

	await runProbe(
		"tool-calling",
		probeToolCalling,
		(tool) => `tool called with args ${JSON.stringify(tool.args)}`,
	);

	// Non-critical: the §3.7 fallback is to pass names/media types as text and
	// leave the vision flag off.
	const visionOk = await runProbe(
		"vision",
		probeVision,
		(vision) =>
			`image_url accepted; model replied: ${JSON.stringify(vision.content).slice(0, 120)}`,
		{ critical: false },
	);

	// The fallback probe is a second round-trip whose value is the prose it
	// prints, so --check skips it rather than emitting an unparseable paragraph.
	if (!visionOk && !checkMode) {
		const reason = results.get("vision").detail;
		console.warn(
			`image_url was rejected (${reason}). Testing the §3.7 text fallback…`,
		);
		try {
			const fallback = await probeTextFallback();
			console.warn(
				`Text fallback (filename/media-type) works: ${JSON.stringify(fallback.content).slice(0, 120)}`,
			);
		} catch (fallbackError) {
			console.warn(
				`Text fallback also failed: ${readableError(fallbackError)}`,
			);
		}
	}

	if (checkMode) renderCheck();
	else render();
	process.exit(criticalFailures.length > 0 ? 1 : 0);
}

main().catch((error) => {
	const message = readableError(error);
	console.error(
		checkMode ? `probe=ERROR ${message}` : `Probe aborted: ${message}`,
	);
	process.exit(1);
});
