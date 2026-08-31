import { ORPCError } from "@orpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { aesGcmEncryptSecret } from "@/auth/providers";
import { db } from "@/db";
import {
	environments,
	itsmConnectorRuns,
	itsmConnectors,
	itsmDispatchLedger,
	itsmEnvironmentRoutes,
	itsmFieldMappings,
	itsmProposals,
	itsmProposalVerdicts,
	itsmTicketOrigins,
	itsmWritebacks,
	tickets,
} from "@/db/schema";
import { env } from "@/env";
import { calculateAgreement } from "../connectors/agreement";
import { calculateConnectorSync } from "../connectors/plan";
import {
	loadConnectorClient,
	loadSyncConfig,
	runConnectorSync,
} from "../connectors/runtime";
import { createConnectorStore } from "../connectors/store";
import { deliverWriteback } from "../connectors/writeback";
import { capabilityProcedure } from "../orpc";

/**
 * Connector administration.
 *
 * Gated on `admin.connectors` rather than `admin.settings`, following the
 * `admin.environments` precedent: a connector holds a credential into the
 * customer's system of record, which is a narrower grant than the one that
 * also covers mail templates and suppliers.
 *
 * No procedure returns `clientSecretEncrypted`. The shape omits it rather than
 * filtering it, the same discipline `getMyTicket` uses.
 */

const encrypt = (secret: string) => {
	const key = env.AXIOMA_PROVIDER_ENCRYPTION_KEY;
	if (!key)
		throw new ORPCError("PRECONDITION_FAILED", {
			message:
				"AXIOMA_PROVIDER_ENCRYPTION_KEY is not configured; connector credentials cannot be stored",
		});
	return aesGcmEncryptSecret(key)(secret);
};

const connectorColumns = {
	id: itsmConnectors.id,
	key: itsmConnectors.key,
	vendor: itsmConnectors.vendor,
	label: itsmConnectors.label,
	baseUrl: itsmConnectors.baseUrl,
	clientId: itsmConnectors.clientId,
	recordFilter: itsmConnectors.recordFilter,
	defaultEnvironmentId: itsmConnectors.defaultEnvironmentId,
	defaultEnvironmentKey: environments.key,
	defaultEnvironmentMode: environments.mode,
	enabled: itsmConnectors.enabled,
	disabledReason: itsmConnectors.disabledReason,
	pollIntervalSeconds: itsmConnectors.pollIntervalSeconds,
	createCeiling: itsmConnectors.createCeiling,
	dispatchCeiling: itsmConnectors.dispatchCeiling,
	consecutiveFailures: itsmConnectors.consecutiveFailures,
	watermark: itsmConnectors.watermark,
	lastSuccessfulSyncAt: itsmConnectors.lastSuccessfulSyncAt,
	createdAt: itsmConnectors.createdAt,
};

async function readConnector(connectorId: string) {
	const [row] = await db
		.select(connectorColumns)
		.from(itsmConnectors)
		.innerJoin(
			environments,
			eq(environments.id, itsmConnectors.defaultEnvironmentId),
		)
		.where(eq(itsmConnectors.id, connectorId))
		.limit(1);
	if (!row)
		throw new ORPCError("NOT_FOUND", { message: "Connector not found" });
	return row;
}

export const connectorsRouter = {
	/**
	 * Read by the portal, so gated on the reporter's own capability rather than
	 * connector administration. It leaks nothing beyond whether a connector is
	 * switched on.
	 */
	portalIsFrontDoor: capabilityProcedure(
		"ticket.read.own",
	).portalIsFrontDoor.handler(async () => {
		const [row] = await db
			.select({ id: itsmConnectors.id })
			.from(itsmConnectors)
			.where(eq(itsmConnectors.enabled, true))
			.limit(1);
		return { foreign: Boolean(row) };
	}),

	/**
	 * The proposal for a ticket's most recent shadow run.
	 *
	 * Gated on run read rather than connector administration: the reviewer is a
	 * support agent working the ticket, not an administrator.
	 */
	getTicketProposal: capabilityProcedure("run.read").getTicketProposal.handler(
		async ({ input }) => {
			const [row] = await db
				.select()
				.from(itsmProposals)
				.where(eq(itsmProposals.ticketId, input.ticketId))
				.orderBy(desc(itsmProposals.createdAt))
				.limit(1);
			if (!row) return null;
			const verdicts = await db
				.select({
					callOrdinal: itsmProposalVerdicts.callOrdinal,
					verdict: itsmProposalVerdicts.verdict,
				})
				.from(itsmProposalVerdicts)
				.where(eq(itsmProposalVerdicts.proposalId, row.id));
			const byOrdinal = new Map(
				verdicts.map((v) => [v.callOrdinal, v.verdict]),
			);
			const calls = (
				row.suppressedCalls as readonly {
					ordinal?: number;
					tool?: string;
					input?: unknown;
				}[]
			).map((call, index) => {
				const ordinal = call.ordinal ?? index;
				return {
					ordinal,
					tool: call.tool ?? "unknown",
					input: call.input ?? null,
					verdict: byOrdinal.get(ordinal) ?? null,
				};
			});
			return {
				id: row.id,
				runId: row.runId,
				ticketId: row.ticketId,
				postedAt: row.postedAt,
				openedAt: row.openedAt,
				calls,
			};
		},
	),

	markProposalOpened: capabilityProcedure(
		"run.read",
	).markProposalOpened.handler(async ({ input }) => {
		// First open only. Overwriting would lose the latency between posting and
		// the first human look, which is the number that says whether the review
		// is happening at all.
		await db
			.update(itsmProposals)
			.set({ openedAt: new Date() })
			.where(
				and(
					eq(itsmProposals.id, input.proposalId),
					isNull(itsmProposals.openedAt),
				),
			);
		return { ok: true };
	}),

	recordProposalVerdict: capabilityProcedure(
		"run.read",
	).recordProposalVerdict.handler(async ({ input, context }) => {
		await db
			.insert(itsmProposalVerdicts)
			.values({
				id: crypto.randomUUID(),
				proposalId: input.proposalId,
				callOrdinal: input.callOrdinal,
				verdict: input.verdict,
				reviewerId: context.userId,
				note: input.note,
			})
			.onConflictDoUpdate({
				target: [
					itsmProposalVerdicts.proposalId,
					itsmProposalVerdicts.callOrdinal,
					itsmProposalVerdicts.reviewerId,
				],
				set: {
					verdict: input.verdict,
					note: input.note,
					decidedAt: new Date(),
				},
			});
		return { ok: true };
	}),

	/**
	 * Agreement, reported with the count that decides whether it means anything.
	 */
	connectorAgreement: capabilityProcedure(
		"admin.connectors",
	).connectorAgreement.handler(async ({ input }) => {
		const rows = await db
			.select({
				suppressedCalls: itsmProposals.suppressedCalls,
				openedAt: itsmProposals.openedAt,
				foreignResolution: itsmProposals.foreignResolution,
			})
			.from(itsmProposals)
			.where(eq(itsmProposals.connectorId, input.connectorId));
		return calculateAgreement(
			rows.map((row) => {
				const calls = row.suppressedCalls as readonly { tool?: string }[];
				return {
					// The coarse action class: what Axel would have done, or that it
					// reached no action at all.
					proposed: calls[0]?.tool ?? "escalate",
					actual: row.foreignResolution ?? "escalate",
					opened: row.openedAt !== null,
				};
			}),
		);
	}),

	/**
	 * Gated on ticket read rather than connector administration: every agent who
	 * can see the ticket needs to know the record is owned elsewhere, and hiding
	 * that from them would make the disabled controls read as a bug.
	 */
	getTicketConnectorOrigin: capabilityProcedure(
		"ticket.read.all",
	).getTicketConnectorOrigin.handler(async ({ input }) => {
		const [row] = await db
			.select({
				connectorId: itsmTicketOrigins.connectorId,
				connectorLabel: itsmConnectors.label,
				vendor: itsmConnectors.vendor,
				externalKey: itsmTicketOrigins.externalKey,
				externalUrl: itsmTicketOrigins.externalUrl,
				foreignUpdatedAt: itsmTicketOrigins.foreignUpdatedAt,
				dispatchCount: itsmTicketOrigins.dispatchCount,
			})
			.from(itsmTicketOrigins)
			.innerJoin(
				itsmConnectors,
				eq(itsmConnectors.id, itsmTicketOrigins.connectorId),
			)
			.where(eq(itsmTicketOrigins.ticketId, input.ticketId))
			.limit(1);
		return row ?? null;
	}),

	listConnectors: capabilityProcedure(
		"admin.connectors",
	).listConnectors.handler(async () =>
		db
			.select(connectorColumns)
			.from(itsmConnectors)
			.innerJoin(
				environments,
				eq(environments.id, itsmConnectors.defaultEnvironmentId),
			)
			.orderBy(itsmConnectors.label),
	),

	createConnector: capabilityProcedure(
		"admin.connectors",
	).createConnector.handler(async ({ input }) => {
		const id = crypto.randomUUID();
		await db.insert(itsmConnectors).values({
			id,
			key: input.key,
			vendor: input.vendor,
			label: input.label,
			baseUrl: input.baseUrl,
			clientId: input.clientId,
			clientSecretEncrypted: encrypt(input.clientSecret),
			recordFilter: input.recordFilter,
			ticketOrigin: "itsm",
			defaultEnvironmentId: input.defaultEnvironmentId,
			fallbackReporterId: input.fallbackReporterId,
			pollIntervalSeconds: input.pollIntervalSeconds,
			createCeiling: input.createCeiling,
			dispatchCeiling: input.dispatchCeiling,
		});
		return readConnector(id);
	}),

	updateConnector: capabilityProcedure(
		"admin.connectors",
	).updateConnector.handler(async ({ input }) => {
		const { connectorId, clientSecret, ...rest } = input;
		await db
			.update(itsmConnectors)
			.set({
				...rest,
				// An omitted secret leaves the stored one untouched, so an
				// administrator can rename a connector without re-entering it.
				...(clientSecret
					? { clientSecretEncrypted: encrypt(clientSecret) }
					: {}),
				// Re-enabling clears the self-disable reason, otherwise the screen
				// keeps showing a failure that no longer applies.
				...(rest.enabled === true
					? { disabledReason: null, consecutiveFailures: 0 }
					: {}),
			})
			.where(eq(itsmConnectors.id, connectorId));
		return readConnector(connectorId);
	}),

	deleteConnector: capabilityProcedure(
		"admin.connectors",
	).deleteConnector.handler(async ({ input }) => {
		// `itsm_ticket_origins.connector_id` is ON DELETE restrict, so a connector
		// with synced tickets cannot be deleted out from under them — the tickets
		// would otherwise become indistinguishable from native ones with their
		// actions silently re-enabled.
		try {
			await db
				.delete(itsmConnectors)
				.where(eq(itsmConnectors.id, input.connectorId));
		} catch {
			throw new ORPCError("CONFLICT", {
				message:
					"This connector still owns synced tickets. Disable it instead of deleting it.",
			});
		}
		return { ok: true };
	}),

	testConnector: capabilityProcedure("admin.connectors").testConnector.handler(
		async ({ input }) => {
			const client = await loadConnectorClient(input.connectorId);
			if (!client)
				return { ok: false, detail: "Connector is disabled or missing" };
			try {
				await client.accessToken();
				return { ok: true, detail: "Credential accepted" };
			} catch (error) {
				return {
					ok: false,
					detail: error instanceof Error ? error.message : String(error),
				};
			}
		},
	),

	previewConnectorSync: capabilityProcedure(
		"admin.connectors",
	).previewConnectorSync.handler(async ({ input }) => {
		const connector = await readConnector(input.connectorId);
		const client = await loadConnectorClient(input.connectorId);
		if (!client)
			throw new ORPCError("PRECONDITION_FAILED", {
				message: "Connector is disabled",
			});
		const [config, records] = await Promise.all([
			loadSyncConfig(input.connectorId),
			client.fetchChangedIncidents({
				since: connector.watermark,
				filter: connector.recordFilter,
			}),
		]);
		const store = createConnectorStore({
			connectorId: input.connectorId,
			ticketOrigin: "itsm",
			fallbackReporterId: "",
		});
		const plan = calculateConnectorSync(
			records,
			await store.knownOrigins(records.map((row) => row.externalId)),
			config,
		);
		return {
			fetchedCount: plan.fetchedCount,
			createCount: plan.createCount,
			updateCount: plan.updateCount,
			skipCount: plan.skipCount,
			dispatchCount: plan.dispatchCount,
			decisions: plan.decisions.map((decision) => ({
				externalId: decision.record.externalId,
				externalKey: decision.record.externalKey,
				kind: decision.kind,
				reason: decision.kind === "skip" ? decision.reason : null,
				willDispatch: decision.kind !== "skip" && decision.triggerKey !== null,
				environmentKey:
					decision.kind === "create"
						? decision.environment.environmentKey
						: null,
				environmentVia:
					decision.kind === "create" ? decision.environment.via : null,
			})),
			quarantined: plan.quarantined.map((issue) => ({
				sourceField: issue.sourceField,
				targetField: issue.targetField as string,
				value: issue.value,
				reason: issue.reason,
			})),
		};
	}),

	triggerConnectorSync: capabilityProcedure(
		"admin.connectors",
	).triggerConnectorSync.handler(async ({ input }) =>
		runConnectorSync(input.connectorId, "apply"),
	),

	listConnectorRuns: capabilityProcedure(
		"admin.connectors",
	).listConnectorRuns.handler(async ({ input }) =>
		db
			.select()
			.from(itsmConnectorRuns)
			.where(eq(itsmConnectorRuns.connectorId, input.connectorId))
			.orderBy(desc(itsmConnectorRuns.createdAt))
			.limit(input.limit),
	),

	listConnectorWritebacks: capabilityProcedure(
		"admin.connectors",
	).listConnectorWritebacks.handler(async ({ input }) =>
		db
			.select({
				id: itsmWritebacks.id,
				connectorId: itsmWritebacks.connectorId,
				ticketId: itsmWritebacks.ticketId,
				ticketNumber: tickets.number,
				status: itsmWritebacks.status,
				attemptCount: itsmWritebacks.attemptCount,
				maxAttempts: itsmWritebacks.maxAttempts,
				nextAttemptAt: itsmWritebacks.nextAttemptAt,
				lastError: itsmWritebacks.lastError,
				createdAt: itsmWritebacks.createdAt,
				completedAt: itsmWritebacks.completedAt,
			})
			.from(itsmWritebacks)
			.innerJoin(tickets, eq(tickets.id, itsmWritebacks.ticketId))
			.where(eq(itsmWritebacks.connectorId, input.connectorId))
			.orderBy(desc(itsmWritebacks.createdAt))
			.limit(input.limit),
	),

	retryConnectorWriteback: capabilityProcedure(
		"admin.connectors",
	).retryConnectorWriteback.handler(async ({ input }) => {
		const [row] = await db
			.select({ connectorId: itsmWritebacks.connectorId })
			.from(itsmWritebacks)
			.where(eq(itsmWritebacks.id, input.writebackId))
			.limit(1);
		if (!row) throw new ORPCError("NOT_FOUND");
		const client = await loadConnectorClient(row.connectorId);
		if (!client)
			throw new ORPCError("PRECONDITION_FAILED", {
				message: "Connector is disabled",
			});
		// A manual retry resets the schedule so an operator does not have to wait
		// out the backoff they are explicitly overriding.
		await db
			.update(itsmWritebacks)
			.set({ status: "retrying", nextAttemptAt: new Date() })
			.where(eq(itsmWritebacks.id, input.writebackId));
		const result = await deliverWriteback(input.writebackId, client);
		return { ok: result === "claimed" };
	}),

	listDispatchLedger: capabilityProcedure(
		"admin.connectors",
	).listDispatchLedger.handler(async ({ input }) =>
		db
			.select({
				id: itsmDispatchLedger.id,
				ticketId: itsmDispatchLedger.ticketId,
				ticketNumber: tickets.number,
				triggerKey: itsmDispatchLedger.triggerKey,
				outcome: itsmDispatchLedger.outcome,
				detail: itsmDispatchLedger.detail,
				dispatchedAt: itsmDispatchLedger.dispatchedAt,
			})
			.from(itsmDispatchLedger)
			.innerJoin(tickets, eq(tickets.id, itsmDispatchLedger.ticketId))
			.where(eq(itsmDispatchLedger.connectorId, input.connectorId))
			.orderBy(desc(itsmDispatchLedger.dispatchedAt))
			.limit(input.limit),
	),

	listFieldMappings: capabilityProcedure(
		"admin.connectors",
	).listFieldMappings.handler(async ({ input }) =>
		db
			.select()
			.from(itsmFieldMappings)
			.where(eq(itsmFieldMappings.connectorId, input.connectorId))
			.orderBy(itsmFieldMappings.targetField),
	),

	upsertFieldMapping: capabilityProcedure(
		"admin.connectors",
	).upsertFieldMapping.handler(async ({ input }) => {
		const id = crypto.randomUUID();
		const [row] = await db
			.insert(itsmFieldMappings)
			.values({ id, ...input })
			.onConflictDoUpdate({
				target: [itsmFieldMappings.connectorId, itsmFieldMappings.targetField],
				set: {
					sourceField: input.sourceField,
					valueMap: input.valueMap,
					onUnmapped: input.onUnmapped,
					defaultValue: input.defaultValue,
				},
			})
			.returning();
		if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return row;
	}),

	deleteFieldMapping: capabilityProcedure(
		"admin.connectors",
	).deleteFieldMapping.handler(async ({ input }) => {
		await db
			.delete(itsmFieldMappings)
			.where(eq(itsmFieldMappings.id, input.mappingId));
		return { ok: true };
	}),

	listEnvironmentRoutes: capabilityProcedure(
		"admin.connectors",
	).listEnvironmentRoutes.handler(async ({ input }) =>
		db
			.select({
				id: itsmEnvironmentRoutes.id,
				connectorId: itsmEnvironmentRoutes.connectorId,
				sourceField: itsmEnvironmentRoutes.sourceField,
				sourceValue: itsmEnvironmentRoutes.sourceValue,
				environmentId: itsmEnvironmentRoutes.environmentId,
				environmentKey: environments.key,
				environmentMode: environments.mode,
				position: itsmEnvironmentRoutes.position,
			})
			.from(itsmEnvironmentRoutes)
			.innerJoin(
				environments,
				eq(environments.id, itsmEnvironmentRoutes.environmentId),
			)
			.where(eq(itsmEnvironmentRoutes.connectorId, input.connectorId))
			.orderBy(itsmEnvironmentRoutes.position),
	),

	upsertEnvironmentRoute: capabilityProcedure(
		"admin.connectors",
	).upsertEnvironmentRoute.handler(async ({ input }) => {
		const id = crypto.randomUUID();
		await db
			.insert(itsmEnvironmentRoutes)
			.values({ id, ...input })
			.onConflictDoUpdate({
				target: [
					itsmEnvironmentRoutes.connectorId,
					itsmEnvironmentRoutes.sourceField,
					itsmEnvironmentRoutes.sourceValue,
				],
				set: {
					environmentId: input.environmentId,
					position: input.position,
				},
			});
		const [row] = await db
			.select({
				id: itsmEnvironmentRoutes.id,
				connectorId: itsmEnvironmentRoutes.connectorId,
				sourceField: itsmEnvironmentRoutes.sourceField,
				sourceValue: itsmEnvironmentRoutes.sourceValue,
				environmentId: itsmEnvironmentRoutes.environmentId,
				environmentKey: environments.key,
				environmentMode: environments.mode,
				position: itsmEnvironmentRoutes.position,
			})
			.from(itsmEnvironmentRoutes)
			.innerJoin(
				environments,
				eq(environments.id, itsmEnvironmentRoutes.environmentId),
			)
			.where(
				and(
					eq(itsmEnvironmentRoutes.connectorId, input.connectorId),
					eq(itsmEnvironmentRoutes.sourceField, input.sourceField),
					eq(itsmEnvironmentRoutes.sourceValue, input.sourceValue),
				),
			)
			.limit(1);
		if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return row;
	}),

	deleteEnvironmentRoute: capabilityProcedure(
		"admin.connectors",
	).deleteEnvironmentRoute.handler(async ({ input }) => {
		await db
			.delete(itsmEnvironmentRoutes)
			.where(eq(itsmEnvironmentRoutes.id, input.routeId));
		return { ok: true };
	}),
};
