import assert from "node:assert/strict";
import test from "node:test";
import { auditChanges, formatTicketNumber } from "./ticket-records";

test("ticket number digits are a minimum and overflow naturally", () => {
	assert.equal(formatTicketNumber("incident", 2026, 42), "INC-2026-00042");
	assert.equal(
		formatTicketNumber("service_request", 2026, 123456),
		"REQ-2026-123456",
	);
});

test("audit helper omits unchanged fields", () => {
	assert.deepEqual(auditChanges({ priority: "P3" }, { priority: "P3" }), []);
	assert.deepEqual(auditChanges({ priority: "P3" }, { priority: "P1" }), [
		{ fieldName: "priority", oldValue: "P3", newValue: "P1" },
	]);
});
