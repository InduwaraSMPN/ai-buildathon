/**
 * Remaining tables that no other module owns.
 *
 * Tier 1 (visible): dynamic fields + values, ticket links/merges, change
 * transitions, CSAT responses.
 * Tier 2 (no dedicated screen today, seeded for completeness): messaging
 * channels/threads/messages, CMDB object properties/environments, ticket↔CI
 * links, team roles, pending followups, calendar holidays, API key rate limits.
 *
 * Deliberately left empty: ticket_presence (written live when someone opens a
 * ticket) and verification (better-auth internal).
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeyRateLimits } from "@/db/schema/api-rate-limits";
import { calendarHolidays } from "@/db/schema/calendars";
import { changes, changeTransitions } from "@/db/schema/changes";
import {
	channelMessages,
	messagingChannels,
	messagingThreads,
} from "@/db/schema/channels";
import { cmdbObjectEnvironments, cmdbObjectProperties } from "@/db/schema/cmdb";
import { ticketCmdbObjects } from "@/db/schema/cmdb-links";
import {
	type DynamicFieldConfig,
	dynamicFields,
	dynamicFieldValues,
} from "@/db/schema/dynamic-fields";
import { ticketLinks, ticketMerges } from "@/db/schema/links";
import { pendingFollowups } from "@/db/schema/pending";
import { ticketCsatResponses } from "@/db/schema/presence";
import { teamRoles } from "@/db/schema/rbac";
import { DEMO_USERS, daysFromEpoch } from "./data";

const DYNAMIC_FIELDS: Array<{
	id: string;
	key: string;
	label: string;
	fieldType: typeof dynamicFields.$inferInsert.fieldType;
	objectType: string;
	config: DynamicFieldConfig;
	order: number;
}> = [
	{
		id: "demo-dynfield-01",
		key: "cost_centre",
		label: "Cost centre",
		fieldType: "text" as const,
		objectType: "ticket",
		config: { maxLength: 16 },
		order: 1,
	},
	{
		id: "demo-dynfield-02",
		key: "affected_users",
		label: "Affected users",
		fieldType: "integer" as const,
		objectType: "ticket",
		config: { min: 1, max: 10000 },
		order: 2,
	},
	{
		id: "demo-dynfield-03",
		key: "business_impact",
		label: "Business impact",
		fieldType: "dropdown" as const,
		objectType: "ticket",
		config: { options: ["None", "Low", "Moderate", "High", "Critical"] },
		order: 3,
	},
	{
		id: "demo-dynfield-04",
		key: "requires_downtime",
		label: "Requires downtime",
		fieldType: "checkbox" as const,
		objectType: "ticket",
		config: {},
		order: 4,
	},
	{
		id: "demo-dynfield-05",
		key: "target_restore_at",
		label: "Target restore time",
		fieldType: "datetime" as const,
		objectType: "ticket",
		config: {},
		order: 5,
	},
	{
		id: "demo-dynfield-06",
		key: "warranty_expires",
		label: "Warranty expires",
		fieldType: "date" as const,
		objectType: "asset",
		config: {},
		order: 1,
	},
];

const DYNAMIC_VALUES: Record<string, unknown[]> = {
	"demo-dynfield-01": ["CC-1001", "CC-2200", "CC-3310", "CC-1001", "CC-4405"],
	"demo-dynfield-02": [1, 12, 340, 5, 90],
	"demo-dynfield-03": ["Critical", "Low", "High", "Moderate", "None"],
	"demo-dynfield-04": [true, false, true, false, false],
};

const LINK_TYPES = [
	"related_to",
	"duplicate_of",
	"caused_by",
	"parent_of",
] as const;

const CSAT = [
	{ rating: 5, comment: "Fixed within the hour — very happy." },
	{ rating: 4, comment: "Good communication, slightly slow to start." },
	{ rating: 5, comment: "Engineer explained the cause clearly." },
	{ rating: 3, comment: "Resolved, but I had to chase for an update." },
	{ rating: 2, comment: "Took several days and reopened once." },
	{ rating: 5, comment: "Excellent — proactive follow-up afterwards." },
	{ rating: 4, comment: "Straightforward and quick." },
	// Sent but never answered, so the CSAT view shows a pending response.
	{ rating: null, comment: null },
] as const;

const HOLIDAYS = [
	{ date: "2026-01-01", name: "New Year's Day" },
	{ date: "2026-04-03", name: "Good Friday" },
	{ date: "2026-05-04", name: "Early May bank holiday" },
	{ date: "2026-08-31", name: "Summer bank holiday" },
	{ date: "2026-12-25", name: "Christmas Day" },
	{ date: "2026-12-28", name: "Boxing Day (substitute)" },
] as const;

export async function seedExtras(ticketIds: string[]): Promise<void> {
	if (!ticketIds.length) {
		console.warn(
			"[seed:extras] no tickets available — skipping ticket-linked rows",
		);
	}

	await db.transaction(async (tx) => {
		// --- Dynamic fields (ticket detail custom-field panel) ----------------
		for (const f of DYNAMIC_FIELDS) {
			await tx
				.insert(dynamicFields)
				.values({
					id: f.id,
					key: f.key,
					label: f.label,
					fieldType: f.fieldType,
					objectType: f.objectType,
					config: f.config,
					displayOrder: f.order,
					isActive: true,
					createdAt: daysFromEpoch(1, 9),
					updatedAt: daysFromEpoch(1, 9),
				})
				.onConflictDoNothing();
		}

		for (const [fieldId, values] of Object.entries(DYNAMIC_VALUES)) {
			for (let i = 0; i < values.length && i < ticketIds.length; i++) {
				await tx
					.insert(dynamicFieldValues)
					.values({
						fieldId,
						objectId: ticketIds[i]!,
						value: values[i],
						updatedAt: daysFromEpoch(6 + i, 11),
					})
					.onConflictDoNothing();
			}
		}

		// --- Ticket links + merges --------------------------------------------
		// Pairs are chosen so no ticket links to itself and no pair repeats.
		for (let i = 0; i + 1 < Math.min(ticketIds.length, 16); i += 2) {
			const relationType = LINK_TYPES[(i / 2) % LINK_TYPES.length]!;
			await tx
				.insert(ticketLinks)
				.values({
					id: `demo-ticket-link-${String(i / 2 + 1).padStart(2, "0")}`,
					ticketId: ticketIds[i]!,
					targetTicketId: ticketIds[i + 1]!,
					relationType,
					createdBy: DEMO_USERS[i % DEMO_USERS.length]!.id,
					createdAt: daysFromEpoch(9 + i, 11),
				})
				.onConflictDoNothing();
		}

		// Two merges: one standing, one that was undone.
		if (ticketIds.length >= 24) {
			await tx
				.insert(ticketMerges)
				.values({
					id: "demo-ticket-merge-01",
					sourceTicketId: ticketIds[20]!,
					targetTicketId: ticketIds[21]!,
					sourcePreviousStatus: "open",
					mergedBy: DEMO_USERS[0]!.id,
					mergedAt: daysFromEpoch(18, 13),
					undoneBy: null,
					undoneAt: null,
				})
				.onConflictDoNothing();
			await tx
				.insert(ticketMerges)
				.values({
					id: "demo-ticket-merge-02",
					sourceTicketId: ticketIds[22]!,
					targetTicketId: ticketIds[23]!,
					sourcePreviousStatus: "pending",
					mergedBy: DEMO_USERS[1]!.id,
					mergedAt: daysFromEpoch(19, 13),
					undoneBy: DEMO_USERS[0]!.id,
					undoneAt: daysFromEpoch(19, 15),
				})
				.onConflictDoNothing();
		}

		// --- Change transitions (change detail history) ------------------------
		const changeRows = await tx
			.select({ id: changes.id, status: changes.status })
			.from(changes);
		for (const change of changeRows) {
			// A plausible path into whatever state the change currently holds.
			const path: Array<[string, string]> =
				change.status === "draft"
					? []
					: change.status === "cancelled"
						? [
								["draft", "submitted"],
								["submitted", "cancelled"],
							]
						: [
								["draft", "submitted"],
								["submitted", "pending_approval"],
							];
			if (
				change.status !== "draft" &&
				change.status !== "submitted" &&
				change.status !== "pending_approval" &&
				change.status !== "cancelled"
			) {
				path.push(["pending_approval", change.status]);
			}
			for (let s = 0; s < path.length; s++) {
				const [fromStatus, toStatus] = path[s]!;
				await tx
					.insert(changeTransitions)
					.values({
						id: `demo-change-transition-${change.id}-${s + 1}`,
						changeId: change.id,
						fromStatus:
							fromStatus as typeof changeTransitions.$inferInsert.fromStatus,
						toStatus:
							toStatus as typeof changeTransitions.$inferInsert.toStatus,
						actorType: "human",
						actorId: DEMO_USERS[s % DEMO_USERS.length]!.id,
						runId: null,
						stepId: null,
						createdAt: daysFromEpoch(11 + s, 10),
					})
					.onConflictDoNothing();
			}
		}

		// --- CSAT --------------------------------------------------------------
		for (let i = 0; i < CSAT.length && i < ticketIds.length; i++) {
			const entry = CSAT[i]!;
			const respondedAt =
				entry.rating === null ? null : daysFromEpoch(20 + i, 15);
			await tx
				.insert(ticketCsatResponses)
				.values({
					id: `demo-csat-${String(i + 1).padStart(2, "0")}`,
					ticketId: ticketIds[i]!,
					token: `demo-csat-token-${String(i + 1).padStart(4, "0")}`,
					rating: entry.rating,
					comment: entry.comment,
					createdAt: daysFromEpoch(19 + i, 9),
					respondedAt,
				})
				.onConflictDoNothing();
		}

		// --- Team roles (capability inheritance via team membership) -----------
		const TEAM_ROLES = [
			{ teamId: "demo-team-platform", roleId: "platform-engineer" },
			{ teamId: "demo-team-helpdesk", roleId: "it-analyst" },
		];
		for (const tr of TEAM_ROLES) {
			await tx
				.insert(teamRoles)
				.values({ ...tr, createdAt: daysFromEpoch(1, 9) })
				.onConflictDoNothing();
		}

		// --- Pending followups --------------------------------------------------
		const reasons = [
			"reporter-information",
			"approval-required",
			"scheduled-change",
		];
		for (let i = 0; i < 8 && i < ticketIds.length; i++) {
			await tx
				.insert(pendingFollowups)
				.values({
					id: `demo-pending-followup-${String(i + 1).padStart(2, "0")}`,
					ticketId: ticketIds[i]!,
					reasonId: reasons[i % reasons.length]!,
					ordinal: i + 1,
					createdAt: daysFromEpoch(12 + i, 10),
				})
				.onConflictDoNothing();
		}

		// --- Calendar holidays ---------------------------------------------------
		for (let i = 0; i < HOLIDAYS.length; i++) {
			const h = HOLIDAYS[i]!;
			await tx
				.insert(calendarHolidays)
				.values({
					id: `demo-holiday-${String(i + 1).padStart(2, "0")}`,
					calendarId: "default-business-hours",
					date: h.date,
					name: h.name,
				})
				.onConflictDoNothing();
		}

		// --- API key rate-limit windows -------------------------------------------
		for (let i = 0; i < 2; i++) {
			await tx
				.insert(apiKeyRateLimits)
				.values({
					apiKeyId: `demo-apikey-${String(i + 1).padStart(2, "0")}`,
					windowStartedAt: daysFromEpoch(27, 9 + i),
					requestCount: 42 + i * 17,
				})
				.onConflictDoNothing();
		}
	});

	// CMDB extras run in their own transaction so a missing class property
	// cannot roll back everything above.
	await db.transaction(async (tx) => {
		const { cmdbClassProperties } = await import("@/db/schema/cmdb");
		const properties = await tx
			.select({
				id: cmdbClassProperties.id,
				classId: cmdbClassProperties.classId,
			})
			.from(cmdbClassProperties);

		for (let i = 0; i < 8; i++) {
			const objectId = `demo-cmdb-${String(i + 1).padStart(2, "0")}`;
			const property = properties[i % Math.max(properties.length, 1)];
			if (property) {
				await tx
					.insert(cmdbObjectProperties)
					.values({
						id: `demo-cmdb-property-${String(i + 1).padStart(2, "0")}`,
						objectId,
						propertyId: property.id,
						value: { seeded: true, note: `Demo property value ${i + 1}` },
					})
					.onConflictDoNothing();
			}

			await tx
				.insert(cmdbObjectEnvironments)
				.values({
					objectId,
					environmentId:
						i % 2 === 0 ? "demo-env-production" : "demo-env-staging",
					createdAt: daysFromEpoch(2, 9),
				})
				.onConflictDoNothing();

			// Link each CI to a ticket so impact analysis has something to walk.
			if (i < ticketIds.length) {
				await tx
					.insert(ticketCmdbObjects)
					.values({
						ticketId: ticketIds[i]!,
						objectId,
						createdAt: daysFromEpoch(10 + i, 11),
					})
					.onConflictDoNothing();
			}
		}
	});

	// --- Messaging channels (no dedicated screen yet; seeded for completeness) --
	await db.transaction(async (tx) => {
		const { ticketOrigins } = await import("@/db/schema/channels");
		const chatOrigin = (
			await tx
				.select({ id: ticketOrigins.id, key: ticketOrigins.key })
				.from(ticketOrigins)
				.where(eq(ticketOrigins.key, "chat"))
				.limit(1)
		)[0];

		const CHANNELS = [
			{
				id: "demo-channel-webchat",
				key: "webchat",
				name: "Portal web chat",
				kind: "webchat" as const,
			},
			{
				id: "demo-channel-sms",
				key: "sms",
				name: "SMS helpline",
				kind: "sms" as const,
			},
		];
		for (const c of CHANNELS) {
			await tx
				.insert(messagingChannels)
				.values({
					id: c.id,
					key: c.key,
					name: c.name,
					kind: c.kind,
					defaultOriginId: chatOrigin?.id ?? null,
					createdAt: daysFromEpoch(2, 9),
				})
				.onConflictDoNothing();
		}

		if (!chatOrigin) return;

		for (let i = 0; i < 6; i++) {
			const threadId = `demo-thread-${String(i + 1).padStart(2, "0")}`;
			const channelId =
				i % 3 === 2 ? "demo-channel-sms" : "demo-channel-webchat";
			const openedAt = daysFromEpoch(13 + i, 9);
			await tx
				.insert(messagingThreads)
				.values({
					id: threadId,
					channelId,
					externalThreadId: `ext-thread-${String(i + 1).padStart(4, "0")}`,
					ticketId: i < ticketIds.length ? ticketIds[i]! : null,
					originKey: chatOrigin.key,
					participantRef:
						channelId === "demo-channel-sms"
							? "+44 7700 900000"
							: `portal-user-${i + 1}`,
					openedAt,
					lastMessageAt: daysFromEpoch(13 + i, 11),
				})
				.onConflictDoNothing();

			for (let m = 0; m < 3; m++) {
				await tx
					.insert(channelMessages)
					.values({
						id: `demo-channel-msg-${String(i + 1).padStart(2, "0")}-${m + 1}`,
						threadId,
						externalMessageId: `ext-msg-${String(i + 1).padStart(4, "0")}-${m + 1}`,
						direction: m % 2 === 0 ? "inbound" : "outbound",
						senderRef: m % 2 === 0 ? "reporter" : "service-desk",
						body:
							m === 0
								? "Hi, my laptop will not connect to the VPN this morning."
								: m === 1
									? "Thanks for getting in touch — can you confirm the error you see?"
									: "It says 'certificate expired'. Screenshot attached.",
						raw: { seeded: true },
						receivedAt: daysFromEpoch(13 + i, 9 + m),
					})
					.onConflictDoNothing();
			}
		}
	});

	console.log(
		"[seed:extras] seeded dynamic fields, ticket links/merges, change transitions, CSAT, team roles, followups, holidays, rate limits, CMDB properties/environments, messaging channels",
	);
}
