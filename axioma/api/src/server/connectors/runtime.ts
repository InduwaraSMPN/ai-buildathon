/**
 * Connector runtime: the poll loop and the deferred-dispatch sweep.
 *
 * A self-rescheduling `setTimeout` with `.unref()`, started from `index.ts`
 * and closed in the signal handler — the same shape as `startRecurrenceSweep`,
 * because the connector needs its own cadence rather than the gateway's
 * ten-second heartbeat.
 *
 * Polling rather than receiving webhooks is forced by the deployment posture:
 * Axiōma runs inside the customer's network, so a cloud ITSM has nowhere to
 * deliver a webhook. Every major platform exposes a "changed since" query for
 * exactly this reason.
 */

import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { aesGcmProviderSecretLoader } from "@/auth/providers";
import { db } from "@/db";
import {
	environments,
	itsmConnectorRuns,
	itsmConnectors,
	itsmDispatchLedger,
	itsmEnvironmentRoutes,
	itsmFieldMappings,
	itsmTicketOrigins,
	serviceSubcategories,
	services,
	ticketStatuses,
} from "@/db/schema";
import { env } from "@/env";
import { grpcGateway } from "../grpc";
import { startTicketRun } from "../routers/shared";
import { findTicket } from "../routers/tickets";
import type { FieldMapping, MappableField } from "./mapping";
import {
	ConnectorCreateCeilingError,
	type ConnectorSyncConfig,
	calculateConnectorSync,
} from "./plan";
import { ServiceNowClient } from "./servicenow";
import { createConnectorStore } from "./store";
import { backfillProposalOutcomes } from "./terminal";
import { sweepWritebacks } from "./writeback";

/** After this many consecutive failures the connector disables itself. */
const FAILURE_CEILING = 10;

const secretLoader = () => {
	const key = env.AXIOMA_PROVIDER_ENCRYPTION_KEY;
	if (!key)
		throw new Error(
			"AXIOMA_PROVIDER_ENCRYPTION_KEY is not configured; connector credentials cannot be read",
		);
	return aesGcmProviderSecretLoader(key);
};

export async function loadConnectorClient(connectorId: string) {
	const [connector] = await db
		.select()
		.from(itsmConnectors)
		.where(eq(itsmConnectors.id, connectorId))
		.limit(1);
	if (!connector || !connector.enabled) return null;
	return new ServiceNowClient({
		baseUrl: connector.baseUrl,
		clientId: connector.clientId,
		clientSecret: secretLoader()(connector.clientSecretEncrypted),
	});
}

/** Assembles the configuration the pure planner needs, from the database. */
export async function loadSyncConfig(
	connectorId: string,
): Promise<ConnectorSyncConfig> {
	const [connector] = await db
		.select()
		.from(itsmConnectors)
		.where(eq(itsmConnectors.id, connectorId))
		.limit(1);
	if (!connector) throw new Error(`Unknown connector ${connectorId}`);

	const [
		mappingRows,
		routeRows,
		statusRows,
		serviceRows,
		subcategoryRows,
		envRows,
		defaultEnv,
	] = await Promise.all([
		db
			.select()
			.from(itsmFieldMappings)
			.where(eq(itsmFieldMappings.connectorId, connectorId)),
		db
			.select({
				sourceField: itsmEnvironmentRoutes.sourceField,
				sourceValue: itsmEnvironmentRoutes.sourceValue,
				position: itsmEnvironmentRoutes.position,
				environmentKey: environments.key,
			})
			.from(itsmEnvironmentRoutes)
			.innerJoin(
				environments,
				eq(environments.id, itsmEnvironmentRoutes.environmentId),
			)
			.where(eq(itsmEnvironmentRoutes.connectorId, connectorId)),
		db.select({ key: ticketStatuses.key }).from(ticketStatuses),
		db.select({ id: services.id }).from(services),
		db.select({ id: serviceSubcategories.id }).from(serviceSubcategories),
		db.select({ key: environments.key }).from(environments),
		db
			.select({ key: environments.key })
			.from(environments)
			.where(eq(environments.id, connector.defaultEnvironmentId))
			.limit(1),
	]);

	const mappings: FieldMapping[] = mappingRows.map((row) => ({
		sourceField: row.sourceField,
		targetField: row.targetField as MappableField,
		valueMap: row.valueMap,
		onUnmapped: row.onUnmapped,
		defaultValue: row.defaultValue ?? undefined,
	}));

	return {
		mappings,
		vocabulary: {
			statusKeys: statusRows.map((row) => row.key),
			serviceIds: serviceRows.map((row) => row.id),
			serviceSubcategoryIds: subcategoryRows.map((row) => row.id),
			defaultServiceId: "svc-general",
			defaultServiceSubcategoryId: "ss-general",
		},
		routes: routeRows,
		defaultEnvironmentKey: defaultEnv[0]?.key ?? "",
		knownEnvironmentKeys: envRows.map((row) => row.key),
		createCeiling: connector.createCeiling,
		dispatchCeiling: connector.dispatchCeiling,
	};
}

/**
 * Runs one sync pass for one connector.
 *
 * `mode` chooses whether the plan is applied, and preview and apply run the
 * same computation — the property `directory/sync.ts` has and the reason its
 * administration screen can be trusted to show what an apply would do.
 *
 * Unlike `directory_sync_runs`, a row is written on every path including the
 * refused and failed ones. A refused sync is exactly the pass an administrator
 * needs to see, and the directory implementation's inability to record one is
 * a gap rather than a precedent.
 */
export async function runConnectorSync(
	connectorId: string,
	mode: "preview" | "apply",
): Promise<{ runId: string; status: "completed" | "rejected" | "failed" }> {
	const runId = crypto.randomUUID();
	const [connector] = await db
		.select()
		.from(itsmConnectors)
		.where(eq(itsmConnectors.id, connectorId))
		.limit(1);
	if (!connector) throw new Error(`Unknown connector ${connectorId}`);

	const record = async (
		status: "completed" | "rejected" | "failed",
		counts: Partial<{
			fetchedCount: number;
			createdCount: number;
			updatedCount: number;
			skippedCount: number;
			dispatchedCount: number;
			quarantinedCount: number;
		}>,
		summary: Record<string, unknown>,
		error?: string,
	) => {
		await db.insert(itsmConnectorRuns).values({
			id: runId,
			connectorId,
			mode,
			status,
			fetchedCount: counts.fetchedCount ?? 0,
			createdCount: counts.createdCount ?? 0,
			updatedCount: counts.updatedCount ?? 0,
			skippedCount: counts.skippedCount ?? 0,
			dispatchedCount: counts.dispatchedCount ?? 0,
			quarantinedCount: counts.quarantinedCount ?? 0,
			error: error ?? null,
			summary,
		});
	};

	try {
		const client = await loadConnectorClient(connectorId);
		if (!client) {
			await record("failed", {}, {}, "connector is disabled or missing");
			return { runId, status: "failed" };
		}
		const config = await loadSyncConfig(connectorId);
		const records = await client.fetchChangedIncidents({
			since: connector.watermark,
			filter: connector.recordFilter,
		});
		const plan = calculateConnectorSync(
			records,
			await createConnectorStore({
				connectorId,
				ticketOrigin: connector.ticketOrigin,
				fallbackReporterId: connector.fallbackReporterId,
			}).knownOrigins(records.map((row) => row.externalId)),
			config,
		);

		let summary: Record<string, unknown> = { preview: true };
		if (mode === "apply") {
			summary = (await createConnectorStore({
				connectorId,
				ticketOrigin: connector.ticketOrigin,
				fallbackReporterId: connector.fallbackReporterId,
			}).apply(plan)) as unknown as Record<string, unknown>;
			if (plan.watermark)
				await db
					.update(itsmConnectors)
					.set({
						watermark: new Date(plan.watermark),
						lastSuccessfulSyncAt: new Date(),
						consecutiveFailures: 0,
						disabledReason: null,
					})
					.where(eq(itsmConnectors.id, connectorId));
		}

		await record(
			"completed",
			{
				fetchedCount: plan.fetchedCount,
				createdCount: plan.createCount,
				updatedCount: plan.updateCount,
				skippedCount: plan.skipCount,
				dispatchedCount: plan.dispatchCount,
				quarantinedCount: plan.quarantined.length,
			},
			summary,
		);
		return { runId, status: "completed" };
	} catch (error) {
		const rejected = error instanceof ConnectorCreateCeilingError;
		const message = error instanceof Error ? error.message : String(error);
		await record(rejected ? "rejected" : "failed", {}, {}, message);
		if (!rejected && mode === "apply") await noteFailure(connectorId);
		return { runId, status: rejected ? "rejected" : "failed" };
	}
}

/**
 * Counts a failure and disables the connector once they are sustained.
 *
 * Stripe's behaviour, and the part most easily left out: an endpoint that has
 * failed for long enough is disabled and its owner told, rather than retried
 * forever against a credential that has been revoked.
 */
async function noteFailure(connectorId: string) {
	const [connector] = await db
		.select({ failures: itsmConnectors.consecutiveFailures })
		.from(itsmConnectors)
		.where(eq(itsmConnectors.id, connectorId))
		.limit(1);
	const failures = (connector?.failures ?? 0) + 1;
	await db
		.update(itsmConnectors)
		.set({
			consecutiveFailures: failures,
			...(failures >= FAILURE_CEILING
				? {
						enabled: false,
						disabledReason: `disabled after ${failures} consecutive failures`,
					}
				: {}),
		})
		.where(eq(itsmConnectors.id, connectorId));
}

/**
 * Starts runs for dispatches that were claimed but could not be dispatched.
 *
 * The ledger row is claimed before the attempt, so a deferral is a row rather
 * than a lost intention. Retrying updates the same row rather than inserting a
 * second, which is what keeps one transition equal to at most one run.
 */
export async function sweepDeferredDispatches(limit = 25): Promise<number> {
	if (!grpcGateway.hasWorker()) return 0;
	const pending = await db
		.select({
			id: itsmDispatchLedger.id,
			ticketId: itsmDispatchLedger.ticketId,
		})
		.from(itsmDispatchLedger)
		.where(eq(itsmDispatchLedger.outcome, "deferred_no_worker"))
		.limit(Math.min(Math.max(limit, 1), 100));

	let dispatched = 0;
	for (const row of pending) {
		try {
			const ticket = await findTicket(row.ticketId);
			const result = await startTicketRun(ticket);
			// A rule-settled ticket returns the ticket itself rather than a run.
			const runId = "ticketId" in result ? null : result.id;
			await db
				.update(itsmDispatchLedger)
				.set({ outcome: "dispatched", runId })
				.where(eq(itsmDispatchLedger.id, row.id));
			await db
				.update(itsmTicketOrigins)
				.set({
					dispatchCount: sql`${itsmTicketOrigins.dispatchCount} + 1`,
				})
				.where(eq(itsmTicketOrigins.ticketId, row.ticketId));
			dispatched += 1;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			// A refusal is a decision, not a transient fault: record it and stop
			// retrying this transition.
			if (!message.includes("Axel is not connected"))
				await db
					.update(itsmDispatchLedger)
					.set({ outcome: "refused", detail: message })
					.where(eq(itsmDispatchLedger.id, row.id));
		}
	}
	return dispatched;
}

let sweep: ReturnType<typeof setTimeout> | undefined;
let closed = true;

/** Polls every due connector, then drains dispatches and write-backs. */
export async function runConnectorTick(now = new Date()): Promise<void> {
	const due = await db
		.select({ id: itsmConnectors.id })
		.from(itsmConnectors)
		.where(
			and(
				eq(itsmConnectors.enabled, true),
				or(
					isNull(itsmConnectors.lastSuccessfulSyncAt),
					lte(itsmConnectors.lastSuccessfulSyncAt, now),
				),
			),
		);
	for (const connector of due) await runConnectorSync(connector.id, "apply");
	await sweepDeferredDispatches();
	// Asks what became of the tickets we proposed on. Without this the agreement
	// surface has nothing to compare against.
	await backfillProposalOutcomes(async (connectorId, externalId) => {
		const client = await loadConnectorClient(connectorId);
		return client ? client.fetchIncidentState(externalId) : null;
	});
	await sweepWritebacks(async (connectorId) =>
		loadConnectorClient(connectorId),
	);
}

export function startConnectorSweep(intervalMs = 60_000) {
	if (!closed) return;
	closed = false;
	const run = () => {
		sweep = undefined;
		void runConnectorTick()
			.catch((error) => console.error("[connectors] sweep failed", error))
			.finally(() => {
				if (!closed) {
					sweep = setTimeout(run, intervalMs);
					sweep.unref();
				}
			});
	};
	sweep = setTimeout(run, 0);
	sweep.unref();
}

export function closeConnectorSweep() {
	closed = true;
	if (sweep) clearTimeout(sweep);
	sweep = undefined;
}
