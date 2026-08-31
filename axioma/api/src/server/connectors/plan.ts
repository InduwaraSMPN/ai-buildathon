/**
 * Pure sync planner for the ITSM connector.
 *
 * Given the records a poll returned, what we already know about them, and the
 * connector's configuration, decide what to create, what to update, and — the
 * part that carries the risk — which of those justify starting an agent run.
 *
 * Dispatch is gated in three layers because no one of them is sufficient:
 *
 * 1. Transition, not state. A field still equal to what it was is not a
 *    change. `State = Resolved` fires on every save; `State changes to
 *    Resolved` fires once.
 * 2. Marker. Every dispatch names the transition that justified it, and that
 *    name is claimed in a ledger with a unique constraint. Re-observing the
 *    same transition produces the same name and is refused.
 * 3. Backstop. A per-ticket ceiling, because the first two are configuration
 *    and configuration is wrong sometimes. `agent/axel/loop.py` bounds a run;
 *    nothing else bounds the number of runs.
 *
 * The third is not defensive padding. `startTicketRun`'s rerun gate is wrapped
 * in `if (ticketState === "open")` — the *state type*, not the status key —
 * and the seeded status keyed `open` has state type `new`, so `canRerun` is
 * never consulted for it. A failed dispatch rolls the status back to `open`.
 * A poller can therefore re-dispatch indefinitely where a human, pressing a
 * button once, never would.
 */

import type {
	EnvironmentResolution,
	EnvironmentRoute,
	FieldMapping,
	ForeignRecord,
	MappedTicket,
	MappingIssue,
	MappingVocabulary,
} from "./mapping";
import { mapForeignRecord, resolveEnvironmentKey } from "./mapping";

/** What we already stored about a foreign record we have seen before. */
export type KnownOrigin = {
	ticketId: string;
	externalId: string;
	/** The foreign `updatedAt` as of our last observation. */
	foreignUpdatedAt: string;
	/** The foreign `updatedAt` our own last write-back produced, if any. */
	lastWrittenAt: string | null;
	/** How many times we have dispatched a run for this ticket. */
	dispatchCount: number;
	/** Whether the ticket currently has a run in a terminal state. */
	hasTerminalRun: boolean;
};

/** A comment observed on a foreign record, used to justify a dispatch. */
export type ForeignComment = {
	externalId: string;
	/** True when the comment was authored by our own integration user. */
	ours: boolean;
	createdAt: string;
};

export type ForeignRecordWithComments = ForeignRecord & {
	comments?: readonly ForeignComment[];
	/** Foreign status value at observation time, if the connector maps one. */
	statusValue?: string | null;
	/** Foreign status value as of our previous observation. */
	previousStatusValue?: string | null;
};

export type SkipReason =
	| "unchanged"
	| "own_write_echo"
	| "dispatch_ceiling_reached"
	| "mapping_rejected"
	| "no_dispatch_trigger";

export type ConnectorSyncDecision =
	| {
			kind: "create";
			record: ForeignRecordWithComments;
			ticket: MappedTicket;
			environment: EnvironmentResolution;
			triggerKey: string;
			quarantined: MappingIssue[];
	  }
	| {
			kind: "update";
			record: ForeignRecordWithComments;
			ticketId: string;
			/** Null when the update does not justify starting a run. */
			triggerKey: string | null;
			quarantined: MappingIssue[];
	  }
	| {
			kind: "skip";
			record: ForeignRecordWithComments;
			reason: SkipReason;
			detail?: string;
	  };

export type ConnectorSyncPlan = {
	fetchedCount: number;
	createCount: number;
	updateCount: number;
	skipCount: number;
	/** Decisions that would start a run. The number worth watching. */
	dispatchCount: number;
	/** Highest foreign `updatedAt` seen, to advance the watermark. */
	watermark: string | null;
	decisions: ConnectorSyncDecision[];
	quarantined: MappingIssue[];
};

export type ConnectorSyncConfig = {
	mappings: readonly FieldMapping[];
	vocabulary: MappingVocabulary;
	routes: readonly EnvironmentRoute[];
	defaultEnvironmentKey: string;
	knownEnvironmentKeys: readonly string[];
	/** Refuse a pass that would create more than this many tickets. */
	createCeiling: number;
	/** Refuse to dispatch a ticket that has already been dispatched this often. */
	dispatchCeiling: number;
};

/**
 * Thrown when one pass would create more tickets than the connector permits.
 *
 * The failure this guards against is a mapping or filter that matches every
 * record rather than the changed ones. Carries both counts, the way
 * `DirectoryShrinkError` does, so the message names the fix.
 */
export class ConnectorCreateCeilingError extends Error {
	constructor(
		readonly ceiling: number,
		readonly attempted: number,
	) {
		super(
			`Connector sync refused: the pass would create ${attempted} tickets, above the ceiling of ${ceiling}. Check the connector filter and the watermark before raising it.`,
		);
		this.name = "ConnectorCreateCeilingError";
	}
}

/**
 * Names the transition that justifies a dispatch.
 *
 * Deliberately keyed on the transition rather than the revision: the same
 * revision can legitimately justify one dispatch and no more, and naming the
 * transition is what makes the ledger claim idempotent rather than merely
 * deduplicated. Re-observing one change yields one key.
 */
export const triggerKeys = {
	created: (externalId: string) => `created:${externalId}`,
	comment: (commentExternalId: string) => `comment:${commentExternalId}`,
	status: (externalId: string, from: string, to: string, at: string) =>
		`status:${externalId}:${from}->${to}@${at}`,
} as const;

const laterOf = (left: string | null, right: string) =>
	left === null || right > left ? right : left;

/**
 * Decides whether an already-known record's update justifies a run, and names
 * the transition if so.
 */
function dispatchTriggerForUpdate(
	record: ForeignRecordWithComments,
	known: KnownOrigin,
): string | null {
	// A comment we did not write is the clearest justification: somebody said
	// something new about a ticket we are working.
	const foreignComment = (record.comments ?? [])
		.filter((comment) => !comment.ours)
		.filter((comment) => comment.createdAt > known.foreignUpdatedAt)
		.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
		.at(-1);
	if (foreignComment) return triggerKeys.comment(foreignComment.externalId);

	// A status transition, named by both ends so that a move back and forth
	// produces two distinct keys rather than colliding.
	const from = record.previousStatusValue ?? null;
	const to = record.statusValue ?? null;
	if (to !== null && from !== null && from !== to)
		return triggerKeys.status(record.externalId, from, to, record.updatedAt);

	return null;
}

/**
 * Computes what a sync pass would do. Pure: no database, no network, no clock.
 *
 * `mode` lives at the caller, as it does for directory sync — preview and
 * apply run this same function and differ only in whether the plan is applied.
 */
export function calculateConnectorSync(
	records: readonly ForeignRecordWithComments[],
	known: readonly KnownOrigin[],
	config: ConnectorSyncConfig,
): ConnectorSyncPlan {
	const byExternalId = new Map(
		known.map((origin) => [origin.externalId, origin]),
	);
	const seen = new Set<string>();
	const decisions: ConnectorSyncDecision[] = [];
	const quarantined: MappingIssue[] = [];
	let watermark: string | null = null;

	for (const record of records) {
		if (seen.has(record.externalId))
			throw new Error(
				`Connector sync received the same external id twice: ${record.externalId}`,
			);
		seen.add(record.externalId);
		watermark = laterOf(watermark, record.updatedAt);

		const existing = byExternalId.get(record.externalId);

		if (!existing) {
			const outcome = mapForeignRecord(
				record,
				config.mappings,
				config.vocabulary,
			);
			if (!outcome.ok) {
				quarantined.push(...outcome.rejected, ...outcome.quarantined);
				decisions.push({
					kind: "skip",
					record,
					reason: "mapping_rejected",
					detail: outcome.rejected.map((issue) => issue.reason).join("; "),
				});
				continue;
			}
			quarantined.push(...outcome.quarantined);
			decisions.push({
				kind: "create",
				record,
				ticket: outcome.ticket,
				environment: resolveEnvironmentKey(
					record,
					config.routes,
					config.defaultEnvironmentKey,
					config.knownEnvironmentKeys,
				),
				triggerKey: triggerKeys.created(record.externalId),
				quarantined: outcome.quarantined,
			});
			continue;
		}

		// Layer one: a record whose foreign timestamp has not moved is not a change.
		if (record.updatedAt <= existing.foreignUpdatedAt) {
			decisions.push({ kind: "skip", record, reason: "unchanged" });
			continue;
		}

		// Our own write-back moves the foreign timestamp. Skip the echo rather
		// than treating it as the customer having done something.
		if (
			existing.lastWrittenAt !== null &&
			record.updatedAt <= existing.lastWrittenAt
		) {
			decisions.push({ kind: "skip", record, reason: "own_write_echo" });
			continue;
		}

		const trigger = dispatchTriggerForUpdate(record, existing);
		if (trigger === null) {
			decisions.push({
				kind: "update",
				record,
				ticketId: existing.ticketId,
				triggerKey: null,
				quarantined: [],
			});
			continue;
		}

		// Layer three: the backstop. Recorded as an update so the ticket still
		// reflects what the customer changed — we stop dispatching, not syncing.
		if (existing.dispatchCount >= config.dispatchCeiling) {
			decisions.push({
				kind: "update",
				record,
				ticketId: existing.ticketId,
				triggerKey: null,
				quarantined: [],
			});
			decisions.push({
				kind: "skip",
				record,
				reason: "dispatch_ceiling_reached",
				detail: `dispatched ${existing.dispatchCount} times, ceiling ${config.dispatchCeiling}`,
			});
			continue;
		}

		decisions.push({
			kind: "update",
			record,
			ticketId: existing.ticketId,
			triggerKey: trigger,
			quarantined: [],
		});
	}

	const createCount = decisions.filter(
		(decision) => decision.kind === "create",
	).length;
	if (createCount > config.createCeiling)
		throw new ConnectorCreateCeilingError(config.createCeiling, createCount);

	return {
		fetchedCount: records.length,
		createCount,
		updateCount: decisions.filter((decision) => decision.kind === "update")
			.length,
		skipCount: decisions.filter((decision) => decision.kind === "skip").length,
		dispatchCount: decisions.filter(
			(decision) => decision.kind !== "skip" && decision.triggerKey !== null,
		).length,
		watermark,
		decisions,
		quarantined,
	};
}

/**
 * The store the planner's result is applied through.
 *
 * Kept as an interface so the planner stays testable without a database, and
 * so preview and apply cannot diverge — the same plan is either applied or
 * returned unapplied.
 */
export type ConnectorSyncStore = {
	knownOrigins(externalIds: readonly string[]): Promise<KnownOrigin[]>;
	apply(plan: ConnectorSyncPlan): Promise<void>;
};

export async function syncConnector(
	store: ConnectorSyncStore,
	records: readonly ForeignRecordWithComments[],
	config: ConnectorSyncConfig,
	mode: "preview" | "apply",
): Promise<ConnectorSyncPlan> {
	const plan = calculateConnectorSync(
		records,
		await store.knownOrigins(records.map((record) => record.externalId)),
		config,
	);
	if (mode === "apply") await store.apply(plan);
	return plan;
}
