import assert from "node:assert/strict";
import test from "node:test";
import {
	type EnvironmentRoute,
	type FieldMapping,
	type ForeignRecord,
	type MappingVocabulary,
	mapForeignRecord,
	resolveEnvironmentKey,
} from "./mapping";

const vocabulary: MappingVocabulary = {
	statusKeys: ["open", "routing", "resolving", "pending", "resolved", "closed"],
	serviceIds: ["svc-general", "svc-infrastructure"],
	serviceSubcategoryIds: ["ss-general", "ss-deployment"],
	defaultServiceId: "svc-general",
	defaultServiceSubcategoryId: "ss-general",
};

const record = (fields: Record<string, string | null>): ForeignRecord => ({
	externalId: "sys-1",
	externalKey: "INC0010023",
	externalUrl: null,
	title: "Checkout is down",
	body: "It will not load.",
	updatedAt: "2026-08-30T10:00:00Z",
	requesterEmail: "someone@example.com",
	fields,
});

test("maps closed enums and derives priority rather than taking it", () => {
	const mappings: FieldMapping[] = [
		{
			sourceField: "impact",
			targetField: "impact",
			valueMap: { "1 - High": "high" },
			onUnmapped: "quarantine",
		},
		{
			sourceField: "urgency",
			targetField: "urgency",
			valueMap: { "1 - High": "high" },
			onUnmapped: "quarantine",
		},
	];
	const outcome = mapForeignRecord(
		record({
			impact: "1 - High",
			urgency: "1 - High",
			priority: "1 - Critical",
		}),
		mappings,
		vocabulary,
	);
	assert.equal(outcome.ok, true);
	if (!outcome.ok) return;
	assert.equal(outcome.ticket.impact, "high");
	assert.equal(outcome.ticket.urgency, "high");
	// P1 is derived from high/high, not read from the foreign priority field.
	assert.equal(outcome.ticket.priority, "P1");
});

test("a foreign priority cannot reach the ticket even if a mapping names it", () => {
	// `priority` is absent from MappableField, so this is a type error at the
	// source. The runtime assertion guards the vocabulary drifting later.
	const mappings = [
		{
			sourceField: "priority",
			targetField: "priority",
			valueMap: { "1 - Critical": "P1" },
			onUnmapped: "quarantine",
		},
	] as unknown as FieldMapping[];
	const outcome = mapForeignRecord(
		record({ priority: "1 - Critical" }),
		mappings,
		vocabulary,
	);
	assert.equal(outcome.ok, true);
	if (!outcome.ok) return;
	// Impact and urgency defaulted to medium, so the derived priority is P3 —
	// the foreign P1 was not honoured.
	assert.equal(outcome.ticket.priority, "P3");
});

test("matches foreign values case-insensitively", () => {
	const outcome = mapForeignRecord(
		record({ state: "RESOLVED" }),
		[
			{
				sourceField: "state",
				targetField: "status",
				valueMap: { resolved: "resolved" },
				onUnmapped: "quarantine",
			},
		],
		vocabulary,
	);
	assert.equal(outcome.ok, true);
	if (!outcome.ok) return;
	assert.equal(outcome.ticket.status, "resolved");
});

test("quarantines an unmapped value instead of losing or inventing the ticket", () => {
	const outcome = mapForeignRecord(
		record({ state: "Awaiting Vendor" }),
		[
			{
				sourceField: "state",
				targetField: "status",
				valueMap: { resolved: "resolved" },
				onUnmapped: "quarantine",
			},
		],
		vocabulary,
	);
	assert.equal(outcome.ok, true);
	if (!outcome.ok) return;
	assert.equal(outcome.ticket.status, null);
	assert.equal(outcome.quarantined.length, 1);
	assert.equal(outcome.quarantined[0]?.value, "Awaiting Vendor");
});

test("rejects the record when the policy says reject", () => {
	const outcome = mapForeignRecord(
		record({ state: "Awaiting Vendor" }),
		[
			{
				sourceField: "state",
				targetField: "status",
				valueMap: { resolved: "resolved" },
				onUnmapped: "reject",
			},
		],
		vocabulary,
	);
	assert.equal(outcome.ok, false);
	if (outcome.ok) return;
	assert.equal(outcome.rejected.length, 1);
});

test("quarantines rather than applying a default that is not itself valid", () => {
	const outcome = mapForeignRecord(
		record({ state: "Awaiting Vendor" }),
		[
			{
				sourceField: "state",
				targetField: "status",
				valueMap: {},
				onUnmapped: "default",
				defaultValue: "not-a-status",
			},
		],
		vocabulary,
	);
	assert.equal(outcome.ok, true);
	if (!outcome.ok) return;
	assert.equal(outcome.ticket.status, null);
	assert.equal(outcome.quarantined.length, 1);
});

test("quarantines a value that maps onto something outside the local vocabulary", () => {
	const outcome = mapForeignRecord(
		record({ state: "Closed Complete" }),
		[
			{
				sourceField: "state",
				targetField: "status",
				valueMap: { "Closed Complete": "archived" },
				onUnmapped: "quarantine",
			},
		],
		vocabulary,
	);
	assert.equal(outcome.ok, true);
	if (!outcome.ok) return;
	assert.equal(outcome.ticket.status, null);
	assert.match(String(outcome.quarantined[0]?.reason), /not a known status/);
});

test("an absent source field is not an error", () => {
	const outcome = mapForeignRecord(
		record({ state: null }),
		[
			{
				sourceField: "state",
				targetField: "status",
				valueMap: { resolved: "resolved" },
				onUnmapped: "reject",
			},
		],
		vocabulary,
	);
	assert.equal(outcome.ok, true);
	if (!outcome.ok) return;
	assert.equal(outcome.ticket.status, null);
	assert.equal(outcome.quarantined.length, 0);
});

const routes: EnvironmentRoute[] = [
	{
		sourceField: "assignment_group",
		sourceValue: "Checkout Platform",
		environmentKey: "prod",
		position: 10,
	},
	{
		sourceField: "assignment_group",
		sourceValue: "Sandbox",
		environmentKey: "staging",
		position: 20,
	},
];

test("an allowlisted foreign value selects its environment", () => {
	const resolution = resolveEnvironmentKey(
		record({ assignment_group: "Checkout Platform" }),
		routes,
		"prod-shadow",
		["prod", "staging", "prod-shadow"],
	);
	assert.equal(resolution.environmentKey, "prod");
	assert.equal(resolution.via, "route");
});

test("an unlisted foreign value falls through to the connector default", () => {
	const resolution = resolveEnvironmentKey(
		record({ assignment_group: "Some Other Queue" }),
		routes,
		"prod-shadow",
		["prod", "staging", "prod-shadow"],
	);
	assert.equal(resolution.environmentKey, "prod-shadow");
	assert.equal(resolution.via, "default");
});

test("a route naming an unknown environment is ignored, not honoured", () => {
	const resolution = resolveEnvironmentKey(
		record({ assignment_group: "Checkout Platform" }),
		[
			{
				sourceField: "assignment_group",
				sourceValue: "Checkout Platform",
				environmentKey: "deleted-env",
				position: 10,
			},
		],
		"prod-shadow",
		["prod", "staging", "prod-shadow"],
	);
	assert.equal(resolution.environmentKey, "prod-shadow");
	assert.equal(resolution.via, "default_after_invalid_route");
});

test("routes are evaluated in position order, first match winning", () => {
	const resolution = resolveEnvironmentKey(
		record({ assignment_group: "Checkout Platform" }),
		[
			{
				sourceField: "assignment_group",
				sourceValue: "Checkout Platform",
				environmentKey: "staging",
				position: 5,
			},
			...routes,
		],
		"prod-shadow",
		["prod", "staging", "prod-shadow"],
	);
	assert.equal(resolution.environmentKey, "staging");
});

test("environment never follows from the mapped service", () => {
	// A record whose service maps to infrastructure but whose routed field is
	// absent must still take the default, not anything implied by the service.
	const outcome = mapForeignRecord(
		record({ category: "Infrastructure" }),
		[
			{
				sourceField: "category",
				targetField: "serviceId",
				valueMap: { Infrastructure: "svc-infrastructure" },
				onUnmapped: "quarantine",
			},
		],
		vocabulary,
	);
	assert.equal(outcome.ok, true);
	if (!outcome.ok) return;
	assert.equal(outcome.ticket.serviceId, "svc-infrastructure");

	const resolution = resolveEnvironmentKey(
		record({ category: "Infrastructure" }),
		routes,
		"prod-shadow",
		["prod", "staging", "prod-shadow"],
	);
	assert.equal(resolution.environmentKey, "prod-shadow");
});
