import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
	new URL(
		"../src/db/migrations/0028_remediation_data_flow.sql",
		import.meta.url,
	),
	"utf8",
);
for (const required of [
	"worker_id",
	"accepted_at",
	"lease_expires_at",
	"agent_runs_expired_lease_idx",
	"claimed_at",
	"webhook_deliveries_delivering_idx",
	"workflow_executions_expired_lease_idx",
	"attempt_count",
	"last_error",
	"ticket_creation_claims",
	"agent_tool_calls",
	"agent_tool_calls_run_call_uidx",
	"verification_deadline_at",
])
	assert.ok(sql.includes(required), `missing P1 migration object: ${required}`);
const watermark = readFileSync(
	new URL(
		"../src/db/migrations/0029_search_reconciliation_watermark.sql",
		import.meta.url,
	),
	"utf8",
);
assert.match(watermark, /search_reconciliation_state/);
assert.match(watermark, /last_reconciled_at/);
console.log("P1 and A14 migration contracts verified.");
