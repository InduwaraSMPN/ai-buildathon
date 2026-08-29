import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { deviceActionInput } from "./device";
import { tools } from "./index";
import { knowledgeSearchInput } from "./knowledge";

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
];

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
});

test("device actions match API, agent, proto, and CLI", async () => {
	const [agent, proto, cli] = await Promise.all([
		read("agent/axel/tools.py"),
		read("api/proto/axioma.proto"),
		read("cli/internal/device/actions.go"),
	]);
	const apiActions = deviceActionInput.shape.action.options;
	assert.deepEqual(apiActions, actions);
	for (const action of actions) {
		assert(quoted(agent).has(action), `agent missing ${action}`);
		assert(
			proto.includes(`DEVICE_ACTION_${action.toUpperCase()}`),
			`proto missing ${action}`,
		);
		assert(quoted(cli).has(action), `CLI missing ${action}`);
	}
});
