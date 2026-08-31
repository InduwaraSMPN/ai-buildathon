/**
 * Connectors seed — 1 demo ServiceNow connector + runs, field mappings, environment routes, dispatch ledger, writebacks, proposals/verdicts.
 * Depends on environments (already seeded by misc or pre-seeded here if needed).
 */

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
	itsmConnectorRuns,
	itsmConnectors,
	itsmDispatchLedger,
	itsmEnvironmentRoutes,
	itsmFieldMappings,
	itsmProposals,
	itsmProposalVerdicts,
	itsmTicketOrigins,
	itsmWritebacks,
} from "@/db/schema/connectors";
import { environments } from "@/db/schema/environments";
import { tickets } from "@/db/schema/tickets";
import { daysFromEpoch } from "./data";

function encryptSecret(secret: string): string {
	// Minimal compliant encrypted string format v1:iv:ciphertext:tag — synthesize fake but structurally valid for demo
	// Actual encryption key not needed for demo seed; use placeholder that passes length checks if any
	const iv = createHash("sha256").update(secret).digest("hex").slice(0, 32);
	const ct = Buffer.from(secret).toString("base64");
	const tag = createHash("sha256").update(ct).digest("hex").slice(0, 32);
	return `v1:${iv}:${ct}:${tag}`;
}

export async function seedConnectors(ticketIds: string[]): Promise<void> {
	// Ensure environments exist for FKs — if misc hasn't run yet, create minimal ones here idempotently
	await db.transaction(async (tx) => {
		const existingEnvs = await tx
			.select({ id: environments.id })
			.from(environments)
			.limit(2);
		if (existingEnvs.length === 0) {
			await tx
				.insert(environments)
				.values({
					id: "demo-env-production",
					key: "production",
					label: "Production",
					connectionType: "in_cluster",
					contextName: "prod-axioma",
					credentialEncrypted: encryptSecret("demo-cred-production"),
					mode: "act",
					isDefault: true,
					createdAt: daysFromEpoch(1, 9),
					updatedAt: daysFromEpoch(1, 9),
				})
				.onConflictDoNothing();
			await tx
				.insert(environments)
				.values({
					id: "demo-env-staging",
					key: "staging",
					label: "Staging",
					connectionType: "kubeconfig",
					contextName: "staging-axioma",
					credentialEncrypted: encryptSecret("demo-cred-staging"),
					mode: "shadow",
					isDefault: false,
					createdAt: daysFromEpoch(1, 9),
					updatedAt: daysFromEpoch(1, 9),
				})
				.onConflictDoNothing();
		}
	});

	await db.transaction(async (tx) => {
		// Resolve env id
		const prodEnv = (
			await tx
				.select({ id: environments.id })
				.from(environments)
				.where(eq(environments.key, "production"))
				.limit(1)
		)[0];
		const stagingEnv = (
			await tx
				.select({ id: environments.id })
				.from(environments)
				.where(eq(environments.key, "staging"))
				.limit(1)
		)[0];
		const defaultEnvId = prodEnv?.id ?? "demo-env-production";
		const stagingEnvId = stagingEnv?.id ?? "demo-env-staging";

		// Fallback reporter — pick first ticket reporter or admin if available
		let fallbackReporterId = ticketIds[0]
			? ((await resolveTicketReporter(ticketIds[0])) ?? ticketIds[0])
			: "demo-user-eng-02";
		// Validate it exists in user table; if not, use demo user
		const { user } = await import("@/db/schema/auth");
		const reporterExists = fallbackReporterId
			? (
					await tx
						.select({ id: user.id })
						.from(user)
						.where(eq(user.id, fallbackReporterId))
						.limit(1)
				)[0]
			: null;
		if (!reporterExists) fallbackReporterId = "demo-user-eng-02";

		// 1 ServiceNow connector
		await tx
			.insert(itsmConnectors)
			.values({
				id: "demo-connector-servicenow",
				key: "demo-servicenow",
				vendor: "servicenow",
				label: "Demo ServiceNow",
				baseUrl: "https://demo.service-now.com",
				authType: "oauth_client_credentials",
				clientId: "demo-client-id",
				clientSecretEncrypted: encryptSecret("demo-client-secret-servicenow"),
				recordFilter: "active=true^assignment_group=axioma",
				ticketOrigin: "itsm",
				defaultEnvironmentId: defaultEnvId,
				fallbackReporterId,
				enabled: true,
				disabledReason: null,
				pollIntervalSeconds: 120,
				createCeiling: 50,
				dispatchCeiling: 3,
				consecutiveFailures: 0,
				watermark: daysFromEpoch(20, 9),
				cursor: "demo-cursor-abc123",
				lastSuccessfulSyncAt: daysFromEpoch(20, 10),
				createdAt: daysFromEpoch(2, 9),
				updatedAt: daysFromEpoch(20, 10),
			})
			.onConflictDoNothing();

		// 2 runs
		for (let i = 0; i < 2; i++) {
			const id = `demo-connector-run-${String(i + 1).padStart(2, "0")}`;
			await tx
				.insert(itsmConnectorRuns)
				.values({
					id,
					connectorId: "demo-connector-servicenow",
					mode: i === 0 ? "preview" : "apply",
					status: "completed",
					fetchedCount: 10 + i * 5,
					createdCount: 3 + i,
					updatedCount: 5 + i,
					skippedCount: 2,
					dispatchedCount: 1,
					quarantinedCount: 0,
					error: null,
					summary: { demo: true, runIndex: i + 1 },
					createdAt: daysFromEpoch(15 + i * 3, 10),
				})
				.onConflictDoNothing();
		}

		// Field mappings — 2
		const mappings: Array<{
			id: string;
			sourceField: string;
			targetField: typeof itsmFieldMappings.$inferInsert.targetField;
			valueMap: Record<string, string>;
			onUnmapped: typeof itsmFieldMappings.$inferInsert.onUnmapped;
			defaultValue: string | null;
		}> = [
			{
				id: "demo-field-map-01",
				sourceField: "priority",
				targetField: "impact" as const,
				valueMap: { "1": "high", "2": "medium", "3": "low" },
				onUnmapped: "default" as const,
				defaultValue: "medium",
			},
			{
				id: "demo-field-map-02",
				sourceField: "state",
				targetField: "status" as const,
				valueMap: {
					"1": "open",
					"2": "pending",
					"6": "resolved",
					"7": "closed",
				},
				onUnmapped: "quarantine" as const,
				defaultValue: null,
			},
		];
		for (const m of mappings) {
			await tx
				.insert(itsmFieldMappings)
				.values({
					id: m.id,
					connectorId: "demo-connector-servicenow",
					sourceField: m.sourceField,
					targetField: m.targetField,
					valueMap: m.valueMap,
					onUnmapped: m.onUnmapped,
					defaultValue: m.defaultValue,
					createdAt: daysFromEpoch(3, 9),
				})
				.onConflictDoNothing();
		}

		// 1 environment route
		await tx
			.insert(itsmEnvironmentRoutes)
			.values({
				id: "demo-env-route-01",
				connectorId: "demo-connector-servicenow",
				sourceField: "assignment_group",
				sourceValue: "production-support",
				environmentId: defaultEnvId,
				position: 0,
				createdAt: daysFromEpoch(3, 9),
			})
			.onConflictDoNothing();
		// Second route for staging as demo
		await tx
			.insert(itsmEnvironmentRoutes)
			.values({
				id: "demo-env-route-02",
				connectorId: "demo-connector-servicenow",
				sourceField: "assignment_group",
				sourceValue: "staging-support",
				environmentId: stagingEnvId,
				position: 1,
				createdAt: daysFromEpoch(3, 9),
			})
			.onConflictDoNothing();

		// Dispatch ledger — 3 entries for first tickets
		for (let i = 0; i < 3; i++) {
			if (!ticketIds[i]) continue;
			const id = `demo-dispatch-${String(i + 1).padStart(2, "0")}`;
			await tx
				.insert(itsmDispatchLedger)
				.values({
					id,
					ticketId: ticketIds[i]!,
					connectorId: "demo-connector-servicenow",
					triggerKey: `ticket.updated:${ticketIds[i]!}:${i}`,
					outcome: "dispatched" as const,
					detail: "Demo dispatch — synthetic seed",
					dispatchedAt: daysFromEpoch(16 + i, 11),
				})
				.onConflictDoNothing();
		}

		// ITSM ticket origins — link 2 tickets as foreign synced
		for (let i = 0; i < 2; i++) {
			if (!ticketIds[i]) continue;
			await tx
				.insert(itsmTicketOrigins)
				.values({
					ticketId: ticketIds[i]!,
					connectorId: "demo-connector-servicenow",
					externalId: `demo-sys-id-${String(i + 1).padStart(4, "0")}`,
					externalKey: `INC00${String(1000 + i).padStart(4, "0")}`,
					externalUrl: `https://demo.service-now.com/nav_to.do?uri=incident.do?sys_id=demo-sys-id-${i + 1}`,
					foreignUpdatedAt: daysFromEpoch(18 + i, 10),
					lastWrittenAt: null,
					dispatchCount: 1,
					createdAt: daysFromEpoch(16 + i, 10),
					updatedAt: daysFromEpoch(16 + i, 10),
				})
				.onConflictDoNothing();
		}

		// Writebacks — 2
		for (let i = 0; i < 2; i++) {
			if (!ticketIds[i]) continue;
			const id = `demo-writeback-${String(i + 1).padStart(2, "0")}`;
			await tx
				.insert(itsmWritebacks)
				.values({
					id,
					connectorId: "demo-connector-servicenow",
					ticketId: ticketIds[i]!,
					kind: "work_note",
					payload: {
						work_notes: `Demo work note ${i + 1} — synthetic seed content for ${ticketIds[i]}`,
					},
					status: i === 0 ? "succeeded" : "pending",
					attemptCount: i === 0 ? 1 : 0,
					maxAttempts: 5,
					nextAttemptAt: i === 1 ? daysFromEpoch(25, 9) : null,
					responseStatus: i === 0 ? 201 : null,
					lastError: null,
					externalReceiptId: i === 0 ? `receipt-demo-${i + 1}` : null,
					createdAt: daysFromEpoch(17 + i, 10),
					completedAt: i === 0 ? daysFromEpoch(17 + i, 11) : null,
				})
				.onConflictDoNothing();
		}

		// Proposals + verdicts — need an agent run; create synthetic run id for demo, but FK requires agent_runs existence?
		// itsm_proposals.runId FK references agent_runs.id ON DELETE cascade — so run must exist, but we can skip FK if we insert a placeholder run first
		// Create a demo agent run for proposals
		const { agentRuns } = await import("@/db/schema/agent");
		const demoRunId = "demo-agent-run-for-proposals";
		if (ticketIds[0]) {
			await tx
				.insert(agentRuns)
				.values({
					id: demoRunId,
					ticketId: ticketIds[0]!,
					status: "running",
					startedAt: daysFromEpoch(14, 10),
					environmentSource: "ticket",
				})
				.onConflictDoNothing();

			// Second run for second proposal
			const demoRunId2 = "demo-agent-run-for-proposals-02";
			if (ticketIds[1]) {
				await tx
					.insert(agentRuns)
					.values({
						id: demoRunId2,
						ticketId: ticketIds[1]!,
						status: "running",
						startedAt: daysFromEpoch(15, 10),
						environmentSource: "ticket",
					})
					.onConflictDoNothing();
			}

			for (let i = 0; i < 2; i++) {
				const runId = i === 0 ? demoRunId : "demo-agent-run-for-proposals-02";
				const proposalId = `demo-itsm-proposal-${String(i + 1).padStart(2, "0")}`;
				const ticketId = ticketIds[i]!;
				await tx
					.insert(itsmProposals)
					.values({
						id: proposalId,
						runId,
						ticketId,
						connectorId: "demo-connector-servicenow",
						suppressedCalls: [
							{
								tool: "update_incident",
								args: { state: "resolved", close_code: "fixed" },
							},
							{
								tool: "add_work_note",
								args: { note: `Proposed fix for ${ticketId}` },
							},
						],
						postedAt: daysFromEpoch(18 + i, 10),
						openedAt: daysFromEpoch(19 + i, 9),
						foreignResolution: i === 0 ? "Resolved with workaround" : null,
						foreignClosedBy: i === 0 ? "servicenow_admin" : null,
						observedAt: i === 0 ? daysFromEpoch(22, 10) : null,
						createdAt: daysFromEpoch(18 + i, 10),
					})
					.onConflictDoNothing();

				// Verdicts — 1 per proposal, accepted/rejected
				const verdictId = `demo-verdict-${String(i + 1).padStart(2, "0")}`;
				await tx
					.insert(itsmProposalVerdicts)
					.values({
						id: verdictId,
						proposalId,
						callOrdinal: 0,
						verdict: i === 0 ? "accepted" : "rejected",
						reviewerId: "demo-user-analyst-01",
						note:
							i === 0
								? "Confirmed — solution matches our known fix"
								: "Rejected — proposed state transition is incorrect",
						decidedAt: daysFromEpoch(20 + i, 11),
					})
					.onConflictDoNothing();
				// Second verdict for second call ordinal
				const verdictId2 = `demo-verdict-${String(i + 1).padStart(2, "0")}-b`;
				await tx
					.insert(itsmProposalVerdicts)
					.values({
						id: verdictId2,
						proposalId,
						callOrdinal: 1,
						verdict: "accepted",
						reviewerId: "demo-user-analyst-02",
						note: "Second call accepted",
						decidedAt: daysFromEpoch(20 + i, 12),
					})
					.onConflictDoNothing();
			}
		}
	});

	console.log(
		"[seed:connectors] seeded ServiceNow connector + runs, mappings, routes, ledger, writebacks, proposals/verdicts",
	);
}

async function resolveTicketReporter(ticketId: string): Promise<string | null> {
	try {
		const row = (
			await db
				.select({ reporterId: tickets.reporterId })
				.from(tickets)
				.where(eq(tickets.id, ticketId))
				.limit(1)
		)[0];
		return row?.reporterId ?? null;
	} catch {
		return null;
	}
}
