/**
 * Transport tests against authored fixtures.
 *
 * **These fixtures were written from ServiceNow's published API documentation,
 * not recorded from a live instance.** That distinction is the point of this
 * comment rather than a disclaimer buried in it: a hand-written mock is a
 * fiction maintained by hand, and fictions drift. A recorded cassette does not
 * drift-detect either — it keeps returning the same response until somebody
 * re-records it — but its currency is at least visible in git history.
 *
 * So these tests prove that the client handles the *shapes* it is given:
 * date conversion, pagination parameters, token caching, 401 handling,
 * `Retry-After`, journal parsing. They do not prove ServiceNow actually sends
 * those shapes. Closing that gap needs a smoke test against a real instance —
 * a free Personal Developer Instance is provisioned in minutes and supports
 * REST integration, and that is the intended path.
 *
 * Each fixture below names the field semantics it depends on, so when a test
 * fails against a real instance it is clear which assumption was wrong.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
	fromServiceNowDateTime,
	parseJournal,
	ServiceNowClient,
	ServiceNowError,
	toForeignRecord,
	toServiceNowDateTime,
} from "./servicenow";

/** Minimal fetch double. Records calls so request shape can be asserted. */
function fakeFetch(
	responses: {
		match: (url: string) => boolean;
		status?: number;
		body?: unknown;
		headers?: Record<string, string>;
	}[],
) {
	const calls: { url: string; init: RequestInit | undefined }[] = [];
	const impl = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		calls.push({ url, init });
		const found = responses.find((response) => response.match(url));
		if (!found) throw new Error(`no fixture for ${url}`);
		return new Response(JSON.stringify(found.body ?? {}), {
			status: found.status ?? 200,
			headers: { "content-type": "application/json", ...found.headers },
		});
	}) as unknown as typeof fetch;
	return { impl, calls };
}

const credentials = {
	baseUrl: "https://example.service-now.com",
	clientId: "client",
	clientSecret: "secret",
};

const tokenFixture = {
	match: (url: string) => url.includes("oauth_token.do"),
	body: { access_token: "token-1", expires_in: 1800 },
};

// ServiceNow date-times are `YYYY-MM-DD HH:MM:SS` in UTC, not ISO 8601.
test("converts to ServiceNow's date-time format, not ISO", () => {
	const value = toServiceNowDateTime(new Date("2026-08-30T10:15:30.000Z"));
	assert.equal(value, "2026-08-30 10:15:30");
	assert.doesNotMatch(value, /T|Z/);
});

test("converts back to something comparable and storable", () => {
	assert.equal(
		fromServiceNowDateTime("2026-08-30 10:15:30"),
		"2026-08-30T10:15:30Z",
	);
	assert.equal(fromServiceNowDateTime("  "), "");
});

test("the round trip is stable, which is what the watermark relies on", () => {
	const original = new Date("2026-08-30T10:15:30.000Z");
	const back = new Date(fromServiceNowDateTime(toServiceNowDateTime(original)));
	assert.equal(back.toISOString(), original.toISOString());
});

test("a token is fetched once and cached", async () => {
	const { impl, calls } = fakeFetch([
		tokenFixture,
		{ match: (url) => url.includes("/api/now/table"), body: { result: [] } },
	]);
	const client = new ServiceNowClient(credentials, impl, () => 1_000_000);
	await client.fetchChangedIncidents({ since: null });
	await client.fetchChangedIncidents({ since: null });
	const tokenCalls = calls.filter((call) =>
		call.url.includes("oauth_token.do"),
	);
	// One token for two requests: the cache is what keeps a poll from
	// re-authenticating on every pass.
	assert.equal(tokenCalls.length, 1);
});

test("the token is refreshed before it expires, not after", async () => {
	const { impl, calls } = fakeFetch([
		tokenFixture,
		{ match: (url) => url.includes("/api/now/table"), body: { result: [] } },
	]);
	let now = 1_000_000;
	const client = new ServiceNowClient(credentials, impl, () => now);
	await client.fetchChangedIncidents({ since: null });
	// Move to inside the skew window before the 1800s expiry.
	now += 1_770_000;
	await client.fetchChangedIncidents({ since: null });
	assert.equal(
		calls.filter((call) => call.url.includes("oauth_token.do")).length,
		2,
	);
});

test("a 401 drops the cached token so the next call re-authenticates", async () => {
	const { impl, calls } = fakeFetch([
		tokenFixture,
		{
			match: (url) => url.includes("/api/now/table"),
			status: 401,
		},
	]);
	const client = new ServiceNowClient(credentials, impl, () => 1_000_000);
	await assert.rejects(
		() => client.fetchChangedIncidents({ since: null }),
		(error: unknown) => {
			assert.ok(error instanceof ServiceNowError);
			assert.equal(error.status, 401);
			return true;
		},
	);
	await assert.rejects(() => client.fetchChangedIncidents({ since: null }));
	// Two token requests, because a revoked credential must not be replayed.
	assert.equal(
		calls.filter((call) => call.url.includes("oauth_token.do")).length,
		2,
	);
});

test("Retry-After is read in seconds and in HTTP-date form", async () => {
	for (const [header, atLeast] of [
		["30", 29_000],
		[new Date(Date.now() + 45_000).toUTCString(), 1],
	] as const) {
		const { impl } = fakeFetch([
			{
				match: (url) => url.includes("oauth_token.do"),
				status: 429,
				headers: { "retry-after": String(header) },
			},
		]);
		const client = new ServiceNowClient(credentials, impl);
		await assert.rejects(
			() => client.accessToken(),
			(error: unknown) => {
				assert.ok(error instanceof ServiceNowError);
				assert.ok((error.retryAfterMs ?? 0) >= atLeast);
				return true;
			},
		);
	}
});

test("the watermark query orders by sys_updated_on for keyset paging", async () => {
	const { impl, calls } = fakeFetch([
		tokenFixture,
		{ match: (url) => url.includes("/api/now/table"), body: { result: [] } },
	]);
	const client = new ServiceNowClient(credentials, impl, () => 1_000_000);
	await client.fetchChangedIncidents({
		since: new Date("2026-08-30T09:00:00Z"),
		filter: "active=true",
	});
	const tableCall = calls.find((call) => call.url.includes("/api/now/table"));
	const query = decodeURIComponent(String(tableCall?.url));
	assert.match(query, /sys_updated_on>2026-08-30 09:00:00/);
	assert.match(query, /active=true/);
	// Ordering is what makes paging stable while records are written underneath.
	assert.match(query, /ORDERBYsys_updated_on/);
});

test("a caret in a filter value cannot inject a second query term", async () => {
	const { impl, calls } = fakeFetch([
		tokenFixture,
		{ match: (url) => url.includes("/api/now/table"), body: { result: [] } },
	]);
	const client = new ServiceNowClient(credentials, impl, () => 1_000_000);
	// `^` separates terms in sysparm_query; a value carrying one would otherwise
	// append a condition the caller did not write.
	await client.fetchChangedIncidents({
		since: new Date("2026-08-30T09:00:00Z"),
	});
	const query = decodeURIComponent(
		String(calls.find((call) => call.url.includes("/api/now/table"))?.url),
	);
	const beforeOrder = query.slice(0, query.indexOf("ORDERBY"));
	assert.equal(beforeOrder.split("^").filter(Boolean).length, 1);
});

/**
 * Fixture provenance: field names from the ServiceNow incident table —
 * `sys_id`, `number`, `short_description`, `description`, `sys_updated_on`,
 * `state`. If a real instance disagrees, this is the assumption to check first.
 */
const incidentRow = {
	sys_id: "d71f7935c0a8016700802b64c67c11c6",
	number: "INC0010023",
	short_description: "Checkout is down",
	description: "It will not load for anyone.",
	sys_updated_on: "2026-08-30 10:15:30",
	state: "2",
	caller_email: "someone@example.com",
	comments_and_work_notes: "",
};

test("a row maps onto the transport-neutral record the planner reads", () => {
	const record = toForeignRecord(incidentRow);
	assert.equal(record.externalId, incidentRow.sys_id);
	assert.equal(record.externalKey, "INC0010023");
	assert.equal(record.updatedAt, "2026-08-30T10:15:30Z");
	assert.equal(record.statusValue, "2");
	assert.equal(record.requesterEmail, "someone@example.com");
	// Structured fields pass through verbatim; this layer does not interpret.
	assert.equal(record.fields.state, "2");
});

test("a row missing optional fields degrades rather than throwing", () => {
	const record = toForeignRecord({ sys_id: "abc", sys_updated_on: "" });
	assert.equal(record.externalId, "abc");
	assert.equal(record.externalKey, "");
	assert.equal(record.title, "");
	assert.equal(record.requesterEmail, null);
});

/**
 * Fixture provenance: the journal is returned as a flattened display string
 * when `sysparm_display_value=true`, in the form
 * `YYYY-MM-DD HH:MM:SS - Name (Work notes)`. This is the single most likely
 * thing in this file to be wrong against a real instance.
 */
const journal = [
	"2026-08-30 10:00:00 - Alice Smith (Work notes)",
	"Restarted the pod.",
	"",
	"2026-08-30 10:05:00 - Axioma (Work notes)",
	"Axiōma ran in shadow mode.",
].join("\n");

test("journal entries are separated and attributed", () => {
	const comments = parseJournal(journal);
	assert.equal(comments.length, 2);
	assert.equal(comments[0]?.ours, false);
	assert.equal(comments[0]?.createdAt, "2026-08-30T10:00:00Z");
});

test("our own entries are recognised, so they cannot justify a run", () => {
	const comments = parseJournal(journal);
	assert.equal(comments[1]?.ours, true);
});

test("an empty journal is not an error", () => {
	assert.deepEqual(parseJournal(""), []);
	assert.deepEqual(parseJournal("   "), []);
});

test("comment ids are stable across parses of the same journal", () => {
	// The dispatch ledger is keyed on these, so an unstable id would let one
	// comment justify a second run.
	const first = parseJournal(journal).map((comment) => comment.externalId);
	const second = parseJournal(journal).map((comment) => comment.externalId);
	assert.deepEqual(first, second);
});

test("a work note posts to the incident and carries the correlation fields", async () => {
	const { impl, calls } = fakeFetch([
		tokenFixture,
		{
			match: (url) => url.includes("/api/now/table/incident/"),
			body: {
				result: { sys_updated_on: "2026-08-30 11:00:00", sys_id: "abc" },
			},
		},
	]);
	const client = new ServiceNowClient(credentials, impl, () => 1_000_000);
	const result = await client.postWorkNote({
		externalId: "abc",
		note: "Axiōma ran in shadow mode.",
		correlationId: "INC-2026-00001",
	});
	const patch = calls.find((call) => call.init?.method === "PATCH");
	const body = JSON.parse(String(patch?.init?.body));
	// A work note, never a public comment: the employee-facing thread belongs to
	// the customer's system.
	assert.equal(body.work_notes, "Axiōma ran in shadow mode.");
	assert.equal(body.comments, undefined);
	assert.equal(body.correlation_id, "INC-2026-00001");
	assert.equal(body.correlation_display, "Axioma");
	// The returned timestamp is what echo suppression stores.
	assert.equal(result.updatedAt, "2026-08-30 11:00:00");
});

test("a work note without a correlation id does not send empty link fields", async () => {
	const { impl, calls } = fakeFetch([
		tokenFixture,
		{
			match: (url) => url.includes("/api/now/table/incident/"),
			body: { result: {} },
		},
	]);
	const client = new ServiceNowClient(credentials, impl, () => 1_000_000);
	await client.postWorkNote({ externalId: "abc", note: "hello" });
	const patch = calls.find((call) => call.init?.method === "PATCH");
	const body = JSON.parse(String(patch?.init?.body));
	assert.equal("correlation_id" in body, false);
	assert.equal("correlation_display" in body, false);
});
