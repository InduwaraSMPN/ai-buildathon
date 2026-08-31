/**
 * Automation seed — ticket rules + firings, workflows + executions + webhook deliveries.
 */

import { db } from "@/db";
import { ticketRuleFirings, ticketRules } from "@/db/schema/rules";
import {
	webhookDeliveries,
	workflowExecutions,
	workflows,
} from "@/db/schema/workflows";
import { daysFromEpoch, WORKFLOW_DEFS } from "./data";

export async function seedAutomation(ticketIds: string[]): Promise<void> {
	await db.transaction(async (tx) => {
		// Ticket rules — 2 beyond baseline starter (positions 1,2). Baseline occupies 0.
		const ruleDefs = [
			{
				id: "demo-rule-01",
				name: "Auto-prioritize high impact incidents to P1",
				position: 1,
				criteria: [{ field: "impact", operator: "equals", value: "high" }],
				actions: [{ type: "set_priority", value: "P1" }],
				enabled: true,
			},
			{
				id: "demo-rule-02",
				name: "Route access requests to identity",
				position: 2,
				criteria: [
					{ field: "serviceId", operator: "equals", value: "svc-access" },
				],
				actions: [{ type: "route", value: "identity" }],
				enabled: true,
			},
		];
		for (const r of ruleDefs) {
			await tx
				.insert(ticketRules)
				.values({
					id: r.id,
					name: r.name,
					position: r.position,
					criteria: r.criteria as never,
					actions: r.actions as never,
					enabled: r.enabled,
					createdAt: daysFromEpoch(2, 9),
					updatedAt: daysFromEpoch(2, 9),
				})
				.onConflictDoNothing();
		}

		// Ticket rule firings — ~6 on seeded tickets
		for (let i = 0; i < 6; i++) {
			const ticketId = ticketIds[i % ticketIds.length]!;
			const rule = ruleDefs[i % ruleDefs.length]!;
			const id = `demo-firing-${String(i + 1).padStart(2, "0")}`;
			await tx
				.insert(ticketRuleFirings)
				.values({
					id,
					ticketId,
					ruleId: rule.id,
					rulePosition: rule.position,
					result: {
						ruleId: rule.id,
						rulePosition: rule.position,
						matched: true,
						applied: rule.actions,
						skipped: [],
					} as never,
					createdAt: daysFromEpoch(5 + i, 10),
				})
				.onConflictDoNothing();
		}

		// Workflows — 3
		for (const w of WORKFLOW_DEFS) {
			await tx
				.insert(workflows)
				.values({
					id: w.id,
					name: w.name,
					triggerEvent: w.triggerEvent,
					conditions: w.conditions as never,
					actions: w.actions as never,
					isActive: true,
					lastRunStatus: iMod(w.id, 2) === 0 ? "succeeded" : "failed",
					lastRunAt: daysFromEpoch(15 + iMod(w.id, 5), 11),
					createdAt: daysFromEpoch(3, 9),
					updatedAt: daysFromEpoch(15, 9),
				})
				.onConflictDoNothing();
		}

		// Workflow executions — ~8
		for (let i = 0; i < 8; i++) {
			const id = `demo-wf-exec-${String(i + 1).padStart(2, "0")}`;
			const workflow = WORKFLOW_DEFS[i % WORKFLOW_DEFS.length]!;
			const ticketId = ticketIds[i % ticketIds.length]!;
			const status =
				i % 4 === 0
					? "running"
					: i % 4 === 1
						? "succeeded"
						: i % 4 === 2
							? "failed"
							: "succeeded";
			const startedAt = daysFromEpoch(12 + i, 10);
			const finishedAt =
				status !== "running" ? daysFromEpoch(12 + i, 11) : null;
			await tx
				.insert(workflowExecutions)
				.values({
					id,
					workflowId: workflow.id,
					triggerEvent: workflow.triggerEvent,
					recordType: "ticket",
					recordId: ticketId,
					status: status as typeof workflowExecutions.$inferInsert.status,
					input: { ticketId, demo: true } as never,
					output: status === "succeeded" ? ({ ok: true } as never) : null,
					error:
						status === "failed" ? "simulated workflow failure for demo" : null,
					startedAt,
					claimedAt: status === "running" ? daysFromEpoch(12 + i, 10) : null,
					leaseExpiresAt:
						status === "running" ? daysFromEpoch(12 + i + 1, 10) : null,
					finishedAt,
				})
				.onConflictDoNothing();
		}

		// Webhook deliveries — ~5 linked to executions
		for (let i = 0; i < 5; i++) {
			const id = `demo-webhook-${String(i + 1).padStart(2, "0")}`;
			const executionId = `demo-wf-exec-${String((i % 8) + 1).padStart(2, "0")}`;
			const status =
				i % 3 === 0 ? "succeeded" : i % 3 === 1 ? "failed" : "pending";
			await tx
				.insert(webhookDeliveries)
				.values({
					id,
					executionId,
					url: `https://hooks.axioma.demo/webhook/demo-${i + 1}`,
					requestHeaders: {
						"Content-Type": "application/json",
						"X-Demo": "true",
					},
					requestBody: JSON.stringify({ demo: true, index: i }),
					status: status as typeof webhookDeliveries.$inferInsert.status,
					attemptCount:
						status === "succeeded" ? 1 : status === "failed" ? 5 : 0,
					maxAttempts: 5,
					nextAttemptAt: status === "pending" ? daysFromEpoch(20 + i, 9) : null,
					responseStatus:
						status === "succeeded" ? 200 : status === "failed" ? 500 : null,
					responseHeaders:
						status === "succeeded"
							? { "content-type": "application/json" }
							: null,
					responseBody:
						status === "succeeded"
							? '{"ok":true}'
							: status === "failed"
								? '{"error":"timeout"}'
								: null,
					lastError:
						status === "failed" ? "simulated webhook delivery failure" : null,
					createdAt: daysFromEpoch(13 + i, 11),
					completedAt: status !== "pending" ? daysFromEpoch(13 + i, 12) : null,
				})
				.onConflictDoNothing();
		}
	});

	console.log(
		"[seed:automation] seeded ticket rules, firings, workflows, executions, webhooks",
	);
}

function iMod(id: string, mod: number): number {
	let sum = 0;
	for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
	return sum % mod;
}
