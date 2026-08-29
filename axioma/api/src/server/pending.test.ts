import assert from "node:assert/strict";
import test from "node:test";

import { nextPendingFollowupAt } from "./pending";

test("pending follow-ups are scheduled from the latest successful sweep", () => {
	assert.equal(
		nextPendingFollowupAt(new Date("2026-01-01T10:00:00Z"), 90).toISOString(),
		"2026-01-01T11:30:00.000Z",
	);
});
