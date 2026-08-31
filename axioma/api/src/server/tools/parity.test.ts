import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import { derivePriority, IMPACT_LEVELS, URGENCY_LEVELS } from "@/shared";
import {
	DEVICE_ACTION_FACETS,
	DEVICE_USER_PROCESSES,
	deviceActionInput,
	deviceReadInput,
} from "./device";
import { tools } from "./index";
import {
	KNOWLEDGE_SOURCES,
	knowledgeFetchInput,
	knowledgeSearchInput,
} from "./knowledge";

const api = resolve(dirname(fileURLToPath(import.meta.url)), "../../../");
const workspace = resolve(api, "..");
const read = (path: string) => readFile(resolve(workspace, path), "utf8");
const quoted = (source: string) =>
	new Set([...source.matchAll(/["']([a-z][a-z0-9_]*)["']/g)].map((m) => m[1]));

const actions = [
	"flush_dns",
	"renew_dhcp_lease",
	"clear_proxy_override",
	"reset_credential_cache",
	"restart_user_process",
	"disable_proxy",
	"refresh_certificate_store",
	"clear_temp_files",
	"clear_outlook_cache",
	"clear_teams_cache",
	"clear_icon_cache",
	"clear_print_queue",
	"gui_invoke_control",
	"gui_set_control_value",
	"gui_toggle_control",
	"gui_select_item",
	"gui_expand_control",
];

const facets = [
	"resolver",
	"adapters",
	"reachability",
	"proxy",
	"identity",
	"processes",
	"certificates",
	"storage",
	"app_cache",
	"printing",
	"screen",
];

// The CLI writes its verifying facets as `"action": {"facet"},` inside one map
// literal. Scope the parse to that literal so no other Go map can satisfy it.
const cliActionFacets = (source: string) => {
	const block =
		/var\s+actionFacets\s*=\s*map\[string\]\[\]string\{([\s\S]*?)^\}/m.exec(
			source,
		);
	assert(block?.[1], "CLI actionFacets map literal not found in actions.go");
	const parsed: Record<string, string[]> = {};
	for (const row of block[1].matchAll(/"([a-z0-9_]+)"\s*:\s*\{([^}]*)\}/g)) {
		const action = row[1];
		const cells = row[2];
		if (!action || cells === undefined) continue;
		parsed[action] = [...cells.matchAll(/"([a-z0-9_]+)"/g)].map(
			(cell) => cell[1] as string,
		);
	}
	return parsed;
};

test("agent tool names and validation boundaries match the API", async () => {
	const agent = await read("agent/axel/tools.py");
	const names = [...agent.matchAll(/name="([a-z_]+)"/g)].map((m) => m[1]);
	assert.deepEqual(names.sort(), Object.keys(tools).sort());
	assert.match(
		agent,
		/class KnowledgeSearch[\s\S]*limit: int = Field\(default=8, ge=1, le=20\)/,
	);
	assert.deepEqual(knowledgeSearchInput.parse({ query: "x" }).limit, 8);
	assert.throws(() => knowledgeSearchInput.parse({ query: "x", limit: 21 }));
	assert.deepEqual(
		knowledgeFetchInput.parse({ source: "article", id: "kb-1" }),
		{
			source: "article",
			id: "kb-1",
		},
	);
	const fetchStart = agent.indexOf("class KnowledgeFetch(StrictToolInput):");
	const fetchEnd = agent.indexOf("# --- cluster", fetchStart);
	assert(
		fetchStart >= 0 && fetchEnd > fetchStart,
		"agent KnowledgeFetch schema not found",
	);
	const fetchClass = agent.slice(fetchStart, fetchEnd);
	const agentSources = [...fetchClass.matchAll(/["']([a-z_]+)["']/g)].map(
		(match) => match[1],
	);
	assert.deepEqual(agentSources, [...KNOWLEDGE_SOURCES]);
	assert.match(fetchClass, /id: str = Field\(min_length=1\)/);
});

test("device actions match API, agent, proto, and CLI", async () => {
	const [agent, proto, cli] = await Promise.all([
		read("agent/axel/tools.py"),
		read("api/proto/axioma.proto"),
		read("cli/internal/device/actions.go"),
	]);
	const apiActions = deviceActionInput.shape.action.options;
	assert.deepEqual(apiActions, actions);
	// Scope the agent side to the action Literal itself. A bare substring scan
	// over tools.py passes on a string that survives anywhere else in the file —
	// DEVICE_GUI_STEPS, a docstring — so it would not notice an action deleted
	// from the enum the model actually chooses from.
	const agentActions = /action: Literal\[([\s\S]*?)\]/.exec(agent)?.[1];
	assert(agentActions, "agent DeviceRunAction action literal not found");
	assert.deepEqual(
		[...agentActions.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]),
		actions,
		"the agent action literal drifted from the API enum",
	);
	for (const action of actions) {
		assert(quoted(agent).has(action), `agent missing ${action}`);
		assert(
			proto.includes(`DEVICE_ACTION_${action.toUpperCase()}`),
			`proto missing ${action}`,
		);
		assert(quoted(cli).has(action), `CLI missing ${action}`);
	}
});

test("device facets match API, agent, proto, and CLI", async () => {
	const [agent, proto, cli] = await Promise.all([
		read("agent/axel/tools.py"),
		read("api/proto/axioma.proto"),
		read("cli/internal/device/actions.go"),
	]);
	assert.deepEqual(deviceReadInput.shape.facets.element.options, facets);
	for (const facet of facets) {
		assert(quoted(agent).has(facet), `agent missing facet ${facet}`);
		assert(
			proto.includes(`DEVICE_FACET_${facet.toUpperCase()}`),
			`proto missing facet ${facet}`,
		);
		assert(quoted(cli).has(facet), `CLI missing facet ${facet}`);
	}
});

test("restart_user_process allowlist matches API, agent, and CLI", async () => {
	const [agent, cli] = await Promise.all([
		read("agent/axel/tools.py"),
		read("cli/internal/device/actions.go"),
	]);
	for (const process of DEVICE_USER_PROCESSES) {
		assert(quoted(agent).has(process), `agent missing process ${process}`);
		assert(quoted(cli).has(process), `CLI missing process ${process}`);
	}
	// A parameter selects a key; anything unlisted is refused before dispatch.
	const call = (process_name: string) =>
		deviceActionInput.safeParse({
			device_id: "d1",
			action: "restart_user_process",
			parameters: { process_name },
		}).success;
	assert(call("notepad"), "allowlisted process rejected");
	assert(call("NOTEPAD"), "allowlisted process rejected when uppercased");
	assert(!call("calc"), "unlisted process accepted");
	assert(!call(""), "empty process_name accepted");
	assert(
		!deviceActionInput.safeParse({
			device_id: "d1",
			action: "restart_user_process",
			parameters: {},
		}).success,
		"missing process_name accepted",
	);
});

test("every device action has a verifying facet, and the CLI agrees", async () => {
	const cli = await read("cli/internal/device/actions.go");
	assert.deepEqual(
		Object.keys(DEVICE_ACTION_FACETS).sort(),
		[...actions].sort(),
		"DEVICE_ACTION_FACETS does not cover exactly the action set",
	);
	for (const [action, verifiers] of Object.entries(DEVICE_ACTION_FACETS)) {
		assert(verifiers.length > 0, `${action} has no verifying facet`);
		for (const facet of verifiers)
			assert(facets.includes(facet), `${action} names unknown facet ${facet}`);
	}
	const parsed = cliActionFacets(cli);
	// run_command is the one action the CLI implements that the model may never
	// select. The API dispatches it from an approved proposal, so it is absent
	// from the action enum on purpose — assert that rather than excusing it.
	assert(
		"run_command" in parsed,
		"the CLI no longer implements the approved-command action",
	);
	assert(
		!actions.includes("run_command"),
		"run_command reached the model-facing action enum; Axel must only propose",
	);
	delete parsed.run_command;
	assert.deepEqual(
		Object.keys(parsed).sort(),
		Object.keys(DEVICE_ACTION_FACETS).sort(),
		"CLI actionFacets covers a different action set than DEVICE_ACTION_FACETS",
	);
	for (const [action, verifiers] of Object.entries(DEVICE_ACTION_FACETS))
		assert.deepEqual(
			parsed[action],
			verifiers,
			`CLI verifying facet drifted for ${action}`,
		);
});

test("the proto is mirrored into the agent and CLI trees", async () => {
	const [source, agent, cli] = await Promise.all([
		read("api/proto/axioma.proto"),
		read("agent/proto/axioma.proto"),
		read("cli/proto/axioma.proto"),
	]);
	assert.equal(
		agent,
		source,
		"agent/proto/axioma.proto is stale; run pnpm contracts:publish",
	);
	assert.equal(
		cli,
		source,
		"cli/proto/axioma.proto is stale; run pnpm contracts:publish",
	);
});

test("agent priority matrix matches the API priority matrix", async () => {
	const [shared, agent] = await Promise.all([
		read("api/src/shared/index.ts"),
		read("agent/axel/server.py"),
	]);
	const matrix = (source: string) => {
		const result: Record<string, Record<string, string>> = {};
		for (const row of source.matchAll(
			/["']?(high|medium|low)["']?\s*:\s*\{([^}]*)\}/g,
		)) {
			const impact = row[1];
			const cells = row[2];
			if (!impact || !cells) continue;
			const entries: Record<string, string> = {};
			for (const cell of cells.matchAll(
				/["']?(high|medium|low)["']?\s*:\s*["'](P[1-4])["']/g,
			)) {
				const urgency = cell[1];
				const priority = cell[2];
				if (!urgency || !priority) continue;
				entries[urgency] = priority;
			}
			if (Object.keys(entries).length === 3) result[impact] = entries;
		}
		return result;
	};
	const apiMatrix = matrix(shared);
	const agentMatrix = matrix(agent);
	assert.deepEqual(agentMatrix, apiMatrix);
	for (const impact of IMPACT_LEVELS) {
		for (const urgency of URGENCY_LEVELS) {
			assert.equal(
				apiMatrix[impact]?.[urgency],
				derivePriority(impact, urgency),
				`api matrix drifted from derivePriority at ${impact}/${urgency}`,
			);
		}
	}
});

// --- parameter-name parity -------------------------------------------------
// The parity test above compares tool *names* and a couple of hardcoded
// regexes. A parameter added to one schema side only would ship silently, so
// compare every parameter name per tool between the Pydantic classes (from the
// agent registry) and the Zod tool schemas. Without it, `environment` (or any
// other field) added on one side passes CI.

type ParamMap = Record<string, string[]>;

// Unwrap refined/piped schemas to their object shape and return the top-level
// parameter names. Order does not matter — the diff helper compares sets.
function zodParamNames(schema: z.ZodType): string[] {
	let current: unknown = schema;
	while (current && typeof current === "object") {
		const shape = (current as { shape?: Record<string, unknown> }).shape;
		if (shape) return Object.keys(shape);
		const inner = (current as { innerType?: unknown }).innerType;
		if (inner && typeof inner === "object") {
			current = inner;
			continue;
		}
		const defSchema = (current as { _def?: { schema?: unknown } })._def?.schema;
		if (defSchema && typeof defSchema === "object") {
			current = defSchema;
			continue;
		}
		if (typeof inner === "function") {
			current = inner();
			continue;
		}
		break;
	}
	return [];
}

const apiToolParams = (): ParamMap => {
	const map: ParamMap = {};
	for (const [name, handler] of Object.entries(tools))
		map[name] = zodParamNames(handler.input);
	return map;
};

// Parse the agent registry (tool name -> schema_model class) and each
// StrictToolInput class body to recover the parameter names on the agent side.
function agentToolParams(source: string): ParamMap {
	// The file uses CRLF; normalize so line-anchored parsing is portable.
	const normalized = source.replace(/\r\n/g, "\n");
	const registryBlock = /REGISTRY:[\s\S]*?=\s*\{([\s\S]*?)\n\}/.exec(
		normalized,
	);
	assert(registryBlock?.[1], "REGISTRY dict literal not found in tools.py");
	const registry = registryBlock[1];
	const nameToModel: Record<string, string> = {};
	for (const piece of registry.split('name="').slice(1)) {
		const name = piece.slice(0, piece.indexOf('"'));
		const model = /schema_model=(\w+)/.exec(piece)?.[1];
		if (name && model) nameToModel[name] = model;
	}
	const classToParams: Record<string, string[]> = {};
	// A class body is the run of indented lines (members) plus blank separators
	// after `class X(StrictToolInput):`, ending at the next column-0 line. This
	// deliberately consumes member lines that may span several physical lines
	// (multiline Literals) while bounding the body at the next class or section
	// comment, so field extraction never leaks into a neighbouring class.
	for (const cls of normalized.matchAll(
		/class\s+(\w+)\(StrictToolInput\):\n((?:[ \t].*\n|\n)*)/g,
	)) {
		const className = cls[1];
		const body = cls[2];
		if (!className || !body) continue;
		// Field declarations all precede any @model_validator/def in these
		// classes; cut the body there so method internals are ignored.
		const header = body.split(/^\s{4}(?:def |@)/m)[0] ?? body;
		const params = [...header.matchAll(/^\s+([a-z_][a-z0-9_]*)\s*:/gm)].flatMap(
			(m) => (m[1] ? [m[1]] : []),
		);
		classToParams[className] = [...new Set(params)];
	}
	const map: ParamMap = {};
	for (const [tool, model] of Object.entries(nameToModel))
		map[tool] = classToParams[model] ?? [];
	return map;
}

// Report every difference between two parameter maps. An empty result means the
// two sides declare the same parameter names for every tool.
function diffToolParams(agent: ParamMap, api: ParamMap): string[] {
	const diffs: string[] = [];
	for (const tool of [
		...new Set([...Object.keys(agent), ...Object.keys(api)]),
	].sort()) {
		const a = agent[tool] ?? [];
		const b = api[tool] ?? [];
		for (const param of a)
			if (!b.includes(param)) diffs.push(`${tool}: API missing "${param}"`);
		for (const param of b)
			if (!a.includes(param)) diffs.push(`${tool}: AGENT missing "${param}"`);
		if (a.length !== b.length)
			diffs.push(
				`${tool}: parameter count differs (agent=${a.length}, api=${b.length})`,
			);
	}
	return diffs;
}

test("parameter diff helper detects a mismatch on one side", () => {
	const diffs = diffToolParams(
		{ cluster_read_pods: ["namespace", "label_selector", "environment"] },
		{ cluster_read_pods: ["namespace", "label_selector"] },
	);
	assert.deepEqual(diffs, [
		'cluster_read_pods: API missing "environment"',
		"cluster_read_pods: parameter count differs (agent=3, api=2)",
	]);
	// A one-sided API-only parameter is caught too.
	assert.deepEqual(
		diffToolParams(
			{ knowledge_search: ["query", "limit"] },
			{ knowledge_search: ["query", "limit", "facet"] },
		),
		[
			'knowledge_search: AGENT missing "facet"',
			"knowledge_search: parameter count differs (agent=2, api=3)",
		],
	);
	// Matching maps are silent.
	assert.deepEqual(
		diffToolParams(
			{ cluster_read_deployment: ["namespace", "name", "environment"] },
			{ cluster_read_deployment: ["namespace", "name", "environment"] },
		),
		[],
	);
});

test("every tool exposes the same parameter names in the agent and Zod schema", async () => {
	const agent = await read("agent/axel/tools.py");
	assert.deepEqual(diffToolParams(agentToolParams(agent), apiToolParams()), []);
});
