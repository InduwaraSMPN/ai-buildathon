/**
 * Database adapter for the connector. Applies what `plan.ts` decided.
 *
 * Ingestion goes through `createTicketInTransaction`, which owns every shared
 * creation invariant and whose own comment states the contract this file
 * honours: adapters keep their own parsing, authorization and deduplication.
 * Mail is one such adapter and channels another; this is the third.
 *
 * Dispatch is deliberately *not* an inline call to `startTicketRun`. That
 * function throws `SERVICE_UNAVAILABLE` when no agent worker is connected and
 * persists nothing, which for a portal ticket surfaces as an error to the
 * person who clicked the button. A synced ticket has nobody clicking, so an
 * inline call would mean every ticket arriving while the agent restarts is
 * silently never worked. Instead the ledger row is claimed first and carries
 * the outcome, so a deferred dispatch is a row a sweep can find.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
	directoryIdentities,
	itsmDispatchLedger,
	itsmTicketOrigins,
	user,
} from "@/db/schema";
import { createTicketInTransaction } from "../tickets/create";
import type { ConnectorSyncPlan, KnownOrigin } from "./plan";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ConnectorStoreConfig = {
	connectorId: string;
	ticketOrigin: string;
	/** Used when a foreign requester cannot be matched to a local identity. */
	fallbackReporterId: string;
};

/**
 * Resolves a foreign requester onto a real `user` row.
 *
 * `tickets.reporter_id` is NOT NULL with a foreign key, so a synced ticket
 * must land on somebody. Email match first, against identities directory sync
 * already imports; the configured fallback second. Which path was taken is
 * returned rather than swallowed, because collapsing every synced ticket onto
 * one service account degrades both the reporter context Phase 4 assembles and
 * the discriminating power of `ticket_creation_claims`, which is keyed on
 * `(reporter_id, idempotency_key)`.
 */
export async function resolveReporter(
	tx: Transaction,
	email: string | null,
	fallbackReporterId: string,
): Promise<{ reporterId: string; via: "email" | "fallback" }> {
	const trimmed = email?.trim().toLowerCase();
	if (trimmed) {
		const [matched] = await tx
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, trimmed))
			.limit(1);
		if (matched) return { reporterId: matched.id, via: "email" };

		const [identity] = await tx
			.select({ userId: directoryIdentities.userId })
			.from(directoryIdentities)
			.innerJoin(user, eq(user.id, directoryIdentities.userId))
			.where(eq(user.email, trimmed))
			.limit(1);
		if (identity) return { reporterId: identity.userId, via: "email" };
	}
	return { reporterId: fallbackReporterId, via: "fallback" };
}

/**
 * Claims the right to dispatch for one transition.
 *
 * The insert *is* the claim, the same mechanism `inbound_emails` uses for
 * provider message ids. A conflict means this transition already justified a
 * dispatch, so the second observation does nothing rather than starting a
 * second run.
 */
export async function claimDispatch(
	tx: Transaction,
	params: {
		ticketId: string;
		connectorId: string;
		triggerKey: string;
	},
): Promise<string | null> {
	const id = crypto.randomUUID();
	const [claimed] = await tx
		.insert(itsmDispatchLedger)
		.values({
			id,
			ticketId: params.ticketId,
			connectorId: params.connectorId,
			triggerKey: params.triggerKey,
			outcome: "deferred_no_worker",
		})
		.onConflictDoNothing({
			target: [itsmDispatchLedger.ticketId, itsmDispatchLedger.triggerKey],
		})
		.returning({ id: itsmDispatchLedger.id });
	return claimed?.id ?? null;
}

/** The summary an `itsm_connector_runs` row carries, for the admin screens. */
export type ApplySummary = {
	created: { ticketId: string; externalId: string; reporterVia: string }[];
	updated: string[];
	skipped: { externalId: string; reason: string; detail?: string }[];
	dispatchClaims: string[];
	quarantined: unknown[];
};

export function createConnectorStore(config: ConnectorStoreConfig) {
	return {
		async knownOrigins(externalIds: readonly string[]): Promise<KnownOrigin[]> {
			if (!externalIds.length) return [];
			const rows = await db
				.select({
					ticketId: itsmTicketOrigins.ticketId,
					externalId: itsmTicketOrigins.externalId,
					foreignUpdatedAt: itsmTicketOrigins.foreignUpdatedAt,
					lastWrittenAt: itsmTicketOrigins.lastWrittenAt,
					dispatchCount: itsmTicketOrigins.dispatchCount,
				})
				.from(itsmTicketOrigins)
				.where(
					and(
						eq(itsmTicketOrigins.connectorId, config.connectorId),
						inArray(itsmTicketOrigins.externalId, [...externalIds]),
					),
				);
			return rows.map((row) => ({
				ticketId: row.ticketId,
				externalId: row.externalId,
				foreignUpdatedAt: row.foreignUpdatedAt.toISOString(),
				lastWrittenAt: row.lastWrittenAt?.toISOString() ?? null,
				dispatchCount: row.dispatchCount,
				// Terminal-run state is not needed by the planner today; the
				// existing `canRerun` gate and the ledger cover it.
				hasTerminalRun: false,
			}));
		},

		async apply(plan: ConnectorSyncPlan): Promise<ApplySummary> {
			const summary: ApplySummary = {
				created: [],
				updated: [],
				skipped: [],
				dispatchClaims: [],
				quarantined: plan.quarantined,
			};

			for (const decision of plan.decisions) {
				if (decision.kind === "skip") {
					summary.skipped.push({
						externalId: decision.record.externalId,
						reason: decision.reason,
						detail: decision.detail,
					});
					continue;
				}

				if (decision.kind === "create") {
					await db.transaction(async (tx) => {
						const reporter = await resolveReporter(
							tx,
							decision.record.requesterEmail,
							config.fallbackReporterId,
						);
						const created = await createTicketInTransaction(tx, {
							source: "itsm",
							reporterId: reporter.reporterId,
							title: decision.record.title || decision.record.externalKey,
							body: decision.record.body || decision.record.title,
							recordType: decision.ticket.recordType,
							impact: decision.ticket.impact,
							urgency: decision.ticket.urgency,
							serviceId: decision.ticket.serviceId,
							serviceSubcategoryId: decision.ticket.serviceSubcategoryId,
							origin: config.ticketOrigin,
							// Scoped by connector so two connectors cannot collide, and
							// stable so a replayed poll claims rather than duplicates.
							idempotencyKey: `itsm:${config.connectorId}:${decision.record.externalId}`,
						});

						await tx.insert(itsmTicketOrigins).values({
							ticketId: created.ticketId,
							connectorId: config.connectorId,
							externalId: decision.record.externalId,
							externalKey: decision.record.externalKey,
							externalUrl: decision.record.externalUrl,
							foreignUpdatedAt: new Date(decision.record.updatedAt),
						});

						const claim = await claimDispatch(tx, {
							ticketId: created.ticketId,
							connectorId: config.connectorId,
							triggerKey: decision.triggerKey,
						});
						if (claim) summary.dispatchClaims.push(claim);
						summary.created.push({
							ticketId: created.ticketId,
							externalId: decision.record.externalId,
							reporterVia: reporter.via,
						});
					});
					continue;
				}

				await db.transaction(async (tx) => {
					await tx
						.update(itsmTicketOrigins)
						.set({ foreignUpdatedAt: new Date(decision.record.updatedAt) })
						.where(eq(itsmTicketOrigins.ticketId, decision.ticketId));
					summary.updated.push(decision.ticketId);

					if (decision.triggerKey === null) return;
					const claim = await claimDispatch(tx, {
						ticketId: decision.ticketId,
						connectorId: config.connectorId,
						triggerKey: decision.triggerKey,
					});
					if (claim) summary.dispatchClaims.push(claim);
				});
			}

			return summary;
		},
	};
}
