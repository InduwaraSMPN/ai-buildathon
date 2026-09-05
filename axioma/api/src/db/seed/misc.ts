/**
 * Misc — environments, documents (kind:"link"), notifications, saved views, dashboard widgets, API keys.
 * Depends on tickets/knowledge/assets for documentLinks, users for notifications/views/widgets.
 */

import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { OVERVIEW_WIDGET_KEYS } from "@/contracts/automation";
import { db } from "@/db";
import { apiKeys } from "@/db/schema/api-keys";
import { dashboardWidgets } from "@/db/schema/dashboards";
import { documentLinks, documents } from "@/db/schema/documents";
import {
	environments,
	serviceEnvironments,
	ticketEnvironments,
} from "@/db/schema/environments";
import { notifications } from "@/db/schema/notifications";
import { tickets } from "@/db/schema/tickets";
import { savedViews } from "@/db/schema/views";
import {
	DEMO_USERS,
	daysFromEpoch,
	REAL_ADMIN_EMAIL,
	REAL_REPORTER_EMAIL,
} from "./data";

const DEMO_ENVIRONMENT_IDS = ["demo-env-production", "demo-env-staging"];

function hashSecret(secret: string): string {
	// Simple sha256 placeholder for api_keys.secretHash
	return createHash("sha256").update(secret).digest("hex");
}

export async function seedMisc(ticketIds: string[]): Promise<void> {
	await db.transaction(async (tx) => {
		// A demo environment holds a fake credential, so it must never displace an
		// operator's own default: resolveRunEnvironment falls back to whichever
		// environment carries isDefault, and demo.ts promises never to modify
		// existing rows. Read the answer before inserting, since the demo rows
		// themselves would otherwise count as the pre-existing default.
		const [existingDefault] = await tx
			.select({ id: environments.id })
			.from(environments)
			.where(eq(environments.isDefault, true))
			.limit(1);
		const adoptDemoDefault = existingDefault === undefined;

		// Environments — 2 (Production, Staging) — already may exist from connectors, but ensure
		await tx
			.insert(environments)
			.values({
				id: "demo-env-production",
				key: "production",
				label: "Production",
				// `default` rather than `in_cluster`: the demo API is a local process,
				// not a pod, so `loadFromCluster` has no service-account token to read
				// and every cluster tool call fails before it reaches the cluster. The
				// bootstrap connection follows KUBECONFIG / AXIOMA_K8S_CONTEXT, which
				// is whatever the operator's own kubeconfig points at — and needs no
				// credential of its own, so none is stored.
				connectionType: "default",
				mode: "act",
				isDefault: adoptDemoDefault,
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
				// The same connection as production, deliberately: what makes a shadow
				// run interesting to watch is the agent reading real state, diagnosing
				// correctly, and *then* being refused the write. Pointing this at an
				// unreachable cluster would fail at the first read instead, and the
				// refusal being demonstrated would be about connectivity rather than
				// about mode.
				connectionType: "default",
				mode: "shadow",
				isDefault: false,
				createdAt: daysFromEpoch(1, 9),
				updatedAt: daysFromEpoch(1, 9),
			})
			.onConflictDoNothing();

		// Linking the baseline services to the demo environments widens what
		// resolveEnvironment will accept for a real ticket, so it is gated on the
		// same "this database has no operator environments yet" test.
		if (adoptDemoDefault) {
			await tx
				.update(environments)
				.set({ isDefault: false })
				.where(inArray(environments.id, DEMO_ENVIRONMENT_IDS));
			await tx
				.update(environments)
				.set({ isDefault: true })
				.where(eq(environments.id, "demo-env-production"));

			await tx
				.insert(serviceEnvironments)
				.values(
					[
						"svc-general",
						"svc-infrastructure",
						"svc-device",
						"svc-access",
					].flatMap((serviceId) => [
						{ serviceId, environmentId: "demo-env-production" },
						{ serviceId, environmentId: "demo-env-staging" },
					]),
				)
				.onConflictDoNothing();
		}
		const firstTicketId = ticketIds[0];
		if (firstTicketId) {
			await tx
				.insert(ticketEnvironments)
				.values(
					ticketIds.slice(0, 8).map((ticketId) => ({
						ticketId,
						environmentId: "demo-env-staging",
					})),
				)
				.onConflictDoNothing();
			await tx
				.update(tickets)
				.set({ deviceId: "demo-device-01" })
				.where(eq(tickets.id, firstTicketId));
		}

		// Documents — ~10 kind:"link" only
		const documentDefs = [
			{
				id: "demo-doc-01",
				displayName: "Q3 Marketing Cost Centre — Approval PDF",
				url: "https://drive.axioma.demo/docs/q3-cost-centre-approval.pdf",
				targetType: "ticket" as const,
				targetIdx: 5,
			},
			{
				id: "demo-doc-02",
				displayName: "VPN troubleshooting screenshot",
				url: "https://drive.axioma.demo/docs/vpn-screenshot.png",
				targetType: "ticket" as const,
				targetIdx: 1,
			},
			{
				id: "demo-doc-03",
				displayName: "Salesforce access approval matrix",
				url: "https://drive.axioma.demo/docs/salesforce-access-matrix.xlsx",
				targetType: "ticket" as const,
				targetIdx: 2,
			},
			{
				id: "demo-doc-04",
				displayName: "Incident response runbook (PDF)",
				url: "https://drive.axioma.demo/docs/incident-runbook.pdf",
				targetType: "ticket" as const,
				targetIdx: 0,
			},
			{
				id: "demo-doc-05",
				displayName: "Acme Cloud contract — signed",
				url: "https://drive.axioma.demo/docs/acme-contract-2026-001.pdf",
				targetType: "ticket" as const,
				targetIdx: 24,
			},
			{
				id: "demo-doc-06",
				displayName: "Hardware request — quote for Dell monitor",
				url: "https://drive.axioma.demo/docs/dell-monitor-quote.pdf",
				targetType: "ticket" as const,
				targetIdx: 7,
			},
			{
				id: "demo-doc-07",
				displayName: "Onboarding checklist attachment",
				url: "https://drive.axioma.demo/kb/onboarding-checklist.pdf",
				targetType: "ticket" as const,
				targetIdx: 10,
			},
			{
				id: "demo-doc-08",
				displayName: "API 502 — Load balancer config snapshot",
				url: "https://drive.axioma.demo/docs/lb-config-2026-08-01.json",
				targetType: "ticket" as const,
				targetIdx: 0,
			},
			{
				id: "demo-doc-09",
				displayName: "Expense reimbursement — receipts",
				url: "https://drive.axioma.demo/docs/expense-receipts-july.zip",
				targetType: "ticket" as const,
				targetIdx: 4,
			},
			{
				id: "demo-doc-10",
				displayName: "Security audit — Q2 findings",
				url: "https://drive.axioma.demo/docs/security-audit-q2.pdf",
				targetType: "ticket" as const,
				targetIdx: 12,
			},
		];
		for (let i = 0; i < documentDefs.length; i++) {
			const d = documentDefs[i]!;
			const createdAt = daysFromEpoch(8 + i, 10);
			await tx
				.insert(documents)
				.values({
					id: d.id,
					kind: "link",
					displayName: d.displayName,
					mediaType: null,
					sha256: null,
					storedFilename: null,
					url: d.url,
					createdAt,
				})
				.onConflictDoNothing();

			const targetId = ticketIds[d.targetIdx % ticketIds.length]!;
			const linkId = `demo-doc-link-${String(i + 1).padStart(2, "0")}`;
			await tx
				.insert(documentLinks)
				.values({
					id: linkId,
					documentId: d.id,
					targetType: d.targetType,
					targetId,
					createdAt,
				})
				.onConflictDoNothing();
		}

		// Notifications — ~15 across real + demo staff users
		// Need real admin id
		const { user } = await import("@/db/schema/auth");
		const adminRow = REAL_ADMIN_EMAIL
			? (
					await tx
						.select({ id: user.id })
						.from(user)
						.where(eq(user.email, REAL_ADMIN_EMAIL))
						.limit(1)
				)[0]
			: undefined;
		const adminId = adminRow?.id ?? DEMO_USERS[0]!.id;
		const portalReporterRow = REAL_REPORTER_EMAIL
			? (
					await tx
						.select({ id: user.id })
						.from(user)
						.where(eq(user.email, REAL_REPORTER_EMAIL))
						.limit(1)
				)[0]
			: undefined;
		const portalReporterId = portalReporterRow?.id ?? DEMO_USERS[4]!.id;

		const notificationRecipients = [
			adminId,
			portalReporterId,
			"demo-user-platform-01",
			"demo-user-analyst-01",
			"demo-user-analyst-02",
		];
		for (let i = 0; i < 15; i++) {
			const id = `demo-notif-${String(i + 1).padStart(2, "0")}`;
			const recipientId =
				notificationRecipients[i % notificationRecipients.length]!;
			const ticketId = ticketIds[i % ticketIds.length]!;
			const eventType =
				i % 3 === 0
					? "ticket.assigned"
					: i % 3 === 1
						? "ticket.updated"
						: "ticket.commented";
			const createdAt = daysFromEpoch(15 + i, 10);
			// Avoid self-notification: pick actor different from recipient
			const actorId =
				DEMO_USERS[(i + 2) % DEMO_USERS.length]!.id !== recipientId
					? DEMO_USERS[(i + 2) % DEMO_USERS.length]!.id
					: DEMO_USERS[(i + 3) % DEMO_USERS.length]!.id;
			await tx
				.insert(notifications)
				.values({
					id,
					recipientId,
					actorId: actorId === recipientId ? null : actorId,
					recordType: "ticket",
					recordId: ticketId,
					eventType,
					eventCount: 1,
					title: `Demo notification ${i + 1}: ${eventType}`,
					body: `This is seeded notification ${i + 1} for ${eventType} on ticket ${ticketId.slice(0, 8)} — synthetic data`,
					metadata: { seeded: true, demoIndex: i },
					readAt: i % 4 === 0 ? daysFromEpoch(16 + i, 10) : null,
					createdAt,
					updatedAt: createdAt,
				})
				.onConflictDoNothing();
		}

		// Saved views — 4 (2 each for admin and portal reporter)
		const savedViewDefs = [
			{
				id: "demo-view-01",
				ownerId: adminId,
				name: "My open tickets",
				filters: { status: ["open", "pending"] },
				objectType: "ticket",
			},
			{
				id: "demo-view-02",
				ownerId: adminId,
				name: "P1 incidents",
				filters: { priority: ["P1"], recordType: ["incident"] },
				objectType: "ticket",
			},
			{
				id: "demo-view-03",
				ownerId: portalReporterId,
				name: "My requests — waiting",
				filters: { status: ["pending"] },
				objectType: "ticket",
			},
			{
				id: "demo-view-04",
				ownerId: portalReporterId,
				name: "My closed requests",
				filters: { status: ["closed"] },
				objectType: "ticket",
			},
		];
		for (const v of savedViewDefs) {
			await tx
				.insert(savedViews)
				.values({
					id: v.id,
					ownerType: "user",
					ownerId: v.ownerId,
					createdById: v.ownerId,
					name: v.name,
					objectType: v.objectType,
					filters: v.filters as never,
					sort: { field: "createdAt", direction: "desc" } as never,
					columns: ["number", "title", "status", "priority"],
					createdAt: daysFromEpoch(5, 9),
					updatedAt: daysFromEpoch(5, 9),
				})
				.onConflictDoNothing();
		}

		// Dashboard widgets — one arrangement per staff user.
		//
		// The keys are the contract's OVERVIEW_WIDGET_KEYS, which the dashboard
		// also renders from. Seeds write to the table directly rather than through
		// setDashboardArrangement, so the contract's enum does not check them: a
		// stored key with no renderer is silently dropped by
		// orderedOverviewWidgets, and an arrangement that leaves nothing
		// renderable falls back to the defaults — a wrong key here produces inert
		// rows, not a visible error. Widths match the dashboard's presentation
		// table; a mismatched width makes the grid ragged because the two
		// double-width widgets are laid out first.
		type WidgetKey = (typeof OVERVIEW_WIDGET_KEYS)[number];
		const WIDGET_WIDTHS: Record<WidgetKey, 1 | 2> = {
			priority: 2,
			confirmation: 1,
			escalations: 1,
			"median-ttr": 1,
			csat: 1,
			"resolution-rate": 2,
		};

		const ARRANGEMENTS: WidgetKey[][] = [
			[
				"priority",
				"confirmation",
				"escalations",
				"median-ttr",
				"csat",
				"resolution-rate",
			],
			["resolution-rate", "median-ttr", "csat", "priority"],
			["priority", "escalations", "confirmation"],
			[
				"escalations",
				"priority",
				"csat",
				"resolution-rate",
				"confirmation",
				"median-ttr",
			],
			["priority", "resolution-rate"],
		];

		const staffIds = [
			adminId,
			...DEMO_USERS.filter((u) => u.kind === "staff").map((u) => u.id),
		];
		const uniqueStaff = [...new Set(staffIds)];

		for (let s = 0; s < uniqueStaff.length; s++) {
			const staffId = uniqueStaff[s]!;
			const keys = ARRANGEMENTS[s % ARRANGEMENTS.length]!;
			const sanitized = staffId.replace(/[^a-zA-Z0-9]/g, "-");

			await tx
				.delete(dashboardWidgets)
				.where(eq(dashboardWidgets.userId, staffId));

			for (let i = 0; i < keys.length; i++) {
				const key = keys[i]!;
				await tx
					.insert(dashboardWidgets)
					.values({
						id: `demo-widget-${sanitized}-${String(i).padStart(2, "0")}`,
						userId: staffId,
						widgetKey: key,
						position: i,
						width: WIDGET_WIDTHS[key],
						settings: null,
						updatedAt: daysFromEpoch(10, 9),
					})
					.onConflictDoNothing();
			}
		}

		// API keys — 2 demo keys
		const apiKeyDefs = [
			{
				id: "demo-apikey-01",
				prefix: "ax_demo_integration_01",
				secret: "demo-secret-integration-01-axioma-32chars",
				name: "Demo integration — read-only",
				capabilities: ["ticket.read.all", "stats.read"] as never,
				expiresAt: daysFromEpoch(365, 9),
			},
			{
				id: "demo-apikey-02",
				prefix: "ax_demo_webhook_02",
				secret: "demo-secret-webhook-02-axioma-32chars!!",
				name: "Demo webhook — full",
				capabilities: [
					"ticket.read.all",
					"ticket.create",
					"ticket.update",
				] as never,
				expiresAt: daysFromEpoch(180, 9),
			},
		];
		for (const k of apiKeyDefs) {
			await tx
				.insert(apiKeys)
				.values({
					id: k.id,
					userId: adminId,
					name: k.name,
					prefix: k.prefix,
					secretHash: hashSecret(k.secret),
					capabilities: k.capabilities,
					expiresAt: k.expiresAt,
					lastUsedAt: null,
					revokedAt: null,
					createdAt: daysFromEpoch(5, 9),
				})
				.onConflictDoNothing();
		}

		// Form submissions — needed for approvals: 1 form submission linked to a ticket
		const { formSubmissions } = await import("@/db/schema/forms");
		// Only insert if ticket exists
		if (ticketIds[2]) {
			await tx
				.insert(formSubmissions)
				.values({
					id: "demo-form-sub-01",
					formId: "form-laptop-request",
					submitterId: DEMO_USERS[5]!.id,
					ticketId: ticketIds[2]!,
					values: {
						model: "MacBook Pro 16-inch (M3 Max)",
						justification: "Need for engineering workload",
					},
					createdAt: daysFromEpoch(6, 10),
				})
				.onConflictDoNothing();
		}

		// Approvals — 5 (mix waiting/approved/rejected)
		const { approvals } = await import("@/db/schema/approvals");
		const approvalDefs = [
			{
				id: "demo-approval-01",
				status: "waiting_for_approval" as const,
				ticketIdx: 2,
				approverIdx: 0,
				requesterIdx: 5,
			},
			{
				id: "demo-approval-02",
				status: "approved" as const,
				ticketIdx: 5,
				approverIdx: 1,
				requesterIdx: 6,
			},
			{
				id: "demo-approval-03",
				status: "rejected" as const,
				ticketIdx: 8,
				approverIdx: 2,
				requesterIdx: 7,
			},
			{
				id: "demo-approval-04",
				status: "approved" as const,
				ticketIdx: 10,
				approverIdx: 0,
				requesterIdx: 8,
			},
			{
				id: "demo-approval-05",
				status: "waiting_for_approval" as const,
				ticketIdx: 12,
				approverIdx: 1,
				requesterIdx: 9,
			},
		];
		for (const a of approvalDefs) {
			if (!ticketIds[a.ticketIdx]) continue;
			// Ensure approver != requester and ticket exists
			const approverId = DEMO_USERS[a.approverIdx]!.id;
			const requesterId = DEMO_USERS[a.requesterIdx]!.id;
			const ticketId = ticketIds[a.ticketIdx]!;
			const requestedAt = daysFromEpoch(7 + a.ticketIdx, 10);
			const decidedAt =
				a.status !== "waiting_for_approval"
					? daysFromEpoch(8 + a.ticketIdx, 11)
					: null;
			await tx
				.insert(approvals)
				.values({
					id: a.id,
					requesterId,
					approverId,
					ticketId,
					submissionId: a.id === "demo-approval-01" ? "demo-form-sub-01" : null,
					status: a.status,
					requestNote: `Demo approval request ${a.id} — please review`,
					decisionNote:
						a.status === "approved"
							? "Approved — proceed"
							: a.status === "rejected"
								? "Rejected — insufficient justification"
								: null,
					requestedAt,
					decidedAt,
				})
				.onConflictDoNothing();
		}
	});

	console.log(
		"[seed:misc] seeded environments, documents, notifications, saved views, dashboard widgets, api keys, approvals",
	);
}
