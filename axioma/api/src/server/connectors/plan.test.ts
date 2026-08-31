import assert from "node:assert/strict";
import test from "node:test";
import type { MappingVocabulary } from "./mapping";
import {
	ConnectorCreateCeilingError,
	type ConnectorSyncConfig,
	calculateConnectorSync,
	type ForeignRecordWithComments,
	type KnownOrigin,
	syncConnector,
	triggerKeys,
} from "./plan";

const vocabulary: MappingVocabulary = {
	statusKeys: ["open", "resolved", "closed"],
	serviceIds: ["svc-general"],
	serviceSubcategoryIds: ["ss-general"],
	defaultServiceId: "svc-general",
	defaultServiceSubcategoryId: "ss-general",
};

const config: ConnectorSyncConfig = {
	mappings: [],
	vocabulary,
	routes: [],
	defaultEnvironmentKey: "prod-shadow",
	knownEnvironmentKeys: ["prod", "prod-shadow"],
	createCeiling: 50,
	dispatchCeiling: 3,
};

const record = (
	overrides: Partial<ForeignRecordWithComments> = {},
): ForeignRecordWithComments => ({
	externalId: "sys-1",
	externalKey: "INC0010023",
	externalUrl: null,
	title: "Checkout is down",
	body: "It will not load.",
	updatedAt: "2026-08-30T10:00:00Z",
	requesterEmail: "someone@example.com",
	fields: {},
	...overrides,
});

const origin = (overrides: Partial<KnownOrigin> = {}): KnownOrigin => ({
	ticketId: "ticket-1",
	externalId: "sys-1",
	foreignUpdatedAt: "2026-08-30T09:00:00Z",
	lastWrittenAt: null,
	dispatchCount: 0,
	hasTerminalRun: false,
	...overrides,
});

test("an unseen record is created and dispatched once", () => {
	const plan = calculateConnectorSync([record()], [], config);
	assert.equal(plan.createCount, 1);
	assert.equal(plan.dispatchCount, 1);
	const decision = plan.decisions[0];
	assert.equal(decision?.kind, "create");
	if (decision?.kind !== "create") return;
	assert.equal(decision.triggerKey, triggerKeys.created("sys-1"));
	assert.equal(decision.environment.environmentKey, "prod-shadow");
});

test("a record whose timestamp has not moved is skipped, not re-dispatched", () => {
	const plan = calculateConnectorSync(
		[record({ updatedAt: "2026-08-30T09:00:00Z" })],
		[origin({ foreignUpdatedAt: "2026-08-30T09:00:00Z" })],
		config,
	);
	assert.equal(plan.dispatchCount, 0);
	assert.equal(plan.decisions[0]?.kind, "skip");
	if (plan.decisions[0]?.kind !== "skip") return;
	assert.equal(plan.decisions[0].reason, "unchanged");
});

test("a save that changes nothing we trigger on updates without dispatching", () => {
	// This is the `State = Resolved` versus `State changes to Resolved`
	// distinction: the record moved, but no transition we act on occurred.
	const plan = calculateConnectorSync(
		[record({ updatedAt: "2026-08-30T11:00:00Z" })],
		[origin()],
		config,
	);
	assert.equal(plan.updateCount, 1);
	assert.equal(plan.dispatchCount, 0);
	const decision = plan.decisions[0];
	assert.equal(decision?.kind, "update");
	if (decision?.kind !== "update") return;
	assert.equal(decision.triggerKey, null);
});

test("a foreign comment justifies a dispatch and names itself as the trigger", () => {
	const plan = calculateConnectorSync(
		[
			record({
				updatedAt: "2026-08-30T11:00:00Z",
				comments: [
					{
						externalId: "cmt-9",
						ours: false,
						createdAt: "2026-08-30T10:30:00Z",
					},
				],
			}),
		],
		[origin()],
		config,
	);
	assert.equal(plan.dispatchCount, 1);
	const decision = plan.decisions[0];
	assert.equal(decision?.kind, "update");
	if (decision?.kind !== "update") return;
	assert.equal(decision.triggerKey, triggerKeys.comment("cmt-9"));
});

test("our own comment does not justify a dispatch", () => {
	const plan = calculateConnectorSync(
		[
			record({
				updatedAt: "2026-08-30T11:00:00Z",
				comments: [
					{
						externalId: "cmt-9",
						ours: true,
						createdAt: "2026-08-30T10:30:00Z",
					},
				],
			}),
		],
		[origin()],
		config,
	);
	assert.equal(plan.dispatchCount, 0);
});

test("re-observing the same comment produces the same trigger key", () => {
	const comments = [
		{ externalId: "cmt-9", ours: false, createdAt: "2026-08-30T10:30:00Z" },
	];
	const first = calculateConnectorSync(
		[record({ updatedAt: "2026-08-30T11:00:00Z", comments })],
		[origin()],
		config,
	);
	const second = calculateConnectorSync(
		[record({ updatedAt: "2026-08-30T11:30:00Z", comments })],
		[origin()],
		config,
	);
	const keyOf = (plan: typeof first) => {
		const decision = plan.decisions[0];
		return decision?.kind === "update" ? decision.triggerKey : null;
	};
	// Identical keys, so the ledger's unique constraint refuses the second.
	assert.equal(keyOf(first), keyOf(second));
});

test("a status transition names both ends, so a move back is a distinct trigger", () => {
	const forward = calculateConnectorSync(
		[
			record({
				updatedAt: "2026-08-30T11:00:00Z",
				previousStatusValue: "In Progress",
				statusValue: "Resolved",
			}),
		],
		[origin()],
		config,
	);
	const back = calculateConnectorSync(
		[
			record({
				updatedAt: "2026-08-30T12:00:00Z",
				previousStatusValue: "Resolved",
				statusValue: "In Progress",
			}),
		],
		[origin()],
		config,
	);
	const keyOf = (plan: typeof forward) => {
		const decision = plan.decisions[0];
		return decision?.kind === "update" ? decision.triggerKey : null;
	};
	assert.notEqual(keyOf(forward), keyOf(back));
	assert.equal(forward.dispatchCount, 1);
	assert.equal(back.dispatchCount, 1);
});

test("a status field that has not changed is not a transition", () => {
	const plan = calculateConnectorSync(
		[
			record({
				updatedAt: "2026-08-30T11:00:00Z",
				previousStatusValue: "In Progress",
				statusValue: "In Progress",
			}),
		],
		[origin()],
		config,
	);
	assert.equal(plan.dispatchCount, 0);
});

test("our own write-back echo is skipped rather than read as a customer change", () => {
	const plan = calculateConnectorSync(
		[record({ updatedAt: "2026-08-30T11:00:00Z" })],
		[origin({ lastWrittenAt: "2026-08-30T11:00:00Z" })],
		config,
	);
	assert.equal(plan.decisions[0]?.kind, "skip");
	if (plan.decisions[0]?.kind !== "skip") return;
	assert.equal(plan.decisions[0].reason, "own_write_echo");
});

test("the dispatch ceiling stops dispatching but keeps syncing the ticket", () => {
	const plan = calculateConnectorSync(
		[
			record({
				updatedAt: "2026-08-30T11:00:00Z",
				comments: [
					{
						externalId: "cmt-9",
						ours: false,
						createdAt: "2026-08-30T10:30:00Z",
					},
				],
			}),
		],
		[origin({ dispatchCount: 3 })],
		config,
	);
	assert.equal(plan.dispatchCount, 0);
	// The update still happens — we stop dispatching, not syncing.
	assert.equal(plan.updateCount, 1);
	const breach = plan.decisions.find((decision) => decision.kind === "skip");
	assert.equal(breach?.kind, "skip");
	if (breach?.kind !== "skip") return;
	assert.equal(breach.reason, "dispatch_ceiling_reached");
});

test("a pass that would create more than the ceiling is refused with both counts", () => {
	const records = Array.from({ length: 4 }, (_, index) =>
		record({ externalId: `sys-${index}` }),
	);
	assert.throws(
		() => calculateConnectorSync(records, [], { ...config, createCeiling: 3 }),
		(error: unknown) => {
			assert.ok(error instanceof ConnectorCreateCeilingError);
			assert.equal(error.ceiling, 3);
			assert.equal(error.attempted, 4);
			return true;
		},
	);
});

test("a duplicated external id in one pass is a hard error", () => {
	assert.throws(
		() => calculateConnectorSync([record(), record()], [], config),
		/same external id twice/,
	);
});

test("the watermark advances to the newest record seen", () => {
	const plan = calculateConnectorSync(
		[
			record({ externalId: "sys-1", updatedAt: "2026-08-30T10:00:00Z" }),
			record({ externalId: "sys-2", updatedAt: "2026-08-30T12:00:00Z" }),
			record({ externalId: "sys-3", updatedAt: "2026-08-30T11:00:00Z" }),
		],
		[],
		config,
	);
	assert.equal(plan.watermark, "2026-08-30T12:00:00Z");
});

test("a mapping rejection skips the record and reports why", () => {
	const plan = calculateConnectorSync(
		[record({ fields: { state: "Weird" } })],
		[],
		{
			...config,
			mappings: [
				{
					sourceField: "state",
					targetField: "status",
					valueMap: {},
					onUnmapped: "reject",
				},
			],
		},
	);
	assert.equal(plan.createCount, 0);
	assert.equal(plan.decisions[0]?.kind, "skip");
	if (plan.decisions[0]?.kind !== "skip") return;
	assert.equal(plan.decisions[0].reason, "mapping_rejected");
	assert.equal(plan.quarantined.length, 1);
});

test("preview computes the plan without applying it", async () => {
	let applied = false;
	const store = {
		knownOrigins: async () => [],
		apply: async () => {
			applied = true;
		},
	};
	const plan = await syncConnector(store, [record()], config, "preview");
	assert.equal(plan.createCount, 1);
	assert.equal(applied, false);
});

test("apply runs the same computation and then applies it", async () => {
	let applied = false;
	const store = {
		knownOrigins: async () => [],
		apply: async () => {
			applied = true;
		},
	};
	const plan = await syncConnector(store, [record()], config, "apply");
	assert.equal(plan.createCount, 1);
	assert.equal(applied, true);
});
