/**
 * Asset statuses, assets, devices, enrolment tokens, device commands + proposals.
 * Depends on users (custodian/owner).
 */

import { createHash } from "node:crypto";
import { db } from "@/db";
import { assetStatuses, assets } from "@/db/schema/assets";
import {
	deviceCommandProposals,
	deviceCommands,
	deviceEnrolmentTokens,
	devices,
} from "@/db/schema/devices";
import { ASSET_NAMES, ASSET_STATUSES, DEMO_USERS, daysFromEpoch } from "./data";

function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export async function seedAssetsAndDevices(): Promise<void> {
	await db.transaction(async (tx) => {
		// Asset statuses (3) — not in baseline
		for (const s of ASSET_STATUSES) {
			await tx
				.insert(assetStatuses)
				.values({ id: s.id, name: s.name })
				.onConflictDoNothing();
		}

		// Assets — ~30
		for (let i = 0; i < ASSET_NAMES.length; i++) {
			const name = ASSET_NAMES[i]!;
			const id = `demo-asset-${String(i + 1).padStart(2, "0")}`;
			const assetTag = `AST-${String(1000 + i).padStart(4, "0")}`;
			const serialNumber = `SN-DEMO-${String(10000 + i).padStart(5, "0")}`;
			// Cycle statuses: mostly Active, some In Repair, a few Retired
			const statusId =
				i % 10 === 9
					? ASSET_STATUSES[2]!.id
					: i % 7 === 6
						? ASSET_STATUSES[1]!.id
						: ASSET_STATUSES[0]!.id;
			// Round-robin custodian across demo users + real users fallback
			const custodian = DEMO_USERS[i % DEMO_USERS.length]!;
			const createdAt = daysFromEpoch(i % 20, 9 + (i % 8));
			await tx
				.insert(assets)
				.values({
					id,
					name,
					assetTag,
					serialNumber,
					statusId,
					custodianId: custodian.id,
					attributes: {
						seeded: true,
						category:
							i < 8
								? "laptop"
								: i < 12
									? "monitor"
									: i < 16
										? "phone"
										: "other",
					},
					createdAt,
					updatedAt: createdAt,
				})
				.onConflictDoNothing();
		}

		// Devices — ~15 enrolled
		const deviceHosts = [
			"ENG-LT-001",
			"ENG-LT-002",
			"ENG-LT-003",
			"SALES-LT-042",
			"SALES-LT-043",
			"FIN-LT-010",
			"FIN-LT-011",
			"IT-LT-001",
			"IT-LT-002",
			"IT-LT-003",
			"IT-LT-004",
			"HR-LT-005",
			"OPS-LT-020",
			"SUPPORT-LT-007",
			"QA-LT-012",
		];
		const platforms = ["win32", "darwin", "linux"];
		for (let i = 0; i < deviceHosts.length; i++) {
			const id = `demo-device-${String(i + 1).padStart(2, "0")}`;
			const hostname = deviceHosts[i]!;
			const owner = DEMO_USERS[i % DEMO_USERS.length]!;
			const createdAt = daysFromEpoch(i % 15, 10);
			const lastSeenAt = daysFromEpoch(28 + (i % 3), 14);
			const connected = i % 4 === 0 ? "online" : "offline";
			await tx
				.insert(devices)
				.values({
					id,
					ownerId: owner.id,
					hostname,
					username: owner.email.split("@")[0]!,
					platform: platforms[i % platforms.length]!,
					release:
						i % 3 === 0
							? "10.0.22631"
							: i % 3 === 1
								? "14.5.0"
								: "6.5.0-30-generic",
					agentVersion: "0.3.1",
					executionEnabled: i % 3 === 0,
					connected: connected as "online" | "offline",
					lastSeenAt,
					enrolledAt: createdAt,
				})
				.onConflictDoNothing();
		}

		// Device enrolment tokens — 5 tokens, 2 used, 3 pending
		for (let i = 0; i < 5; i++) {
			const id = `demo-enrol-token-${String(i + 1).padStart(2, "0")}`;
			const raw = `demo-enrol-raw-token-${i + 1}-axioma-seed`;
			const tokenHash = hashToken(raw);
			const createdBy = DEMO_USERS[i % 4]!.id; // staff users first
			const expiresAt = daysFromEpoch(60, 9);
			const createdAt = daysFromEpoch(i, 9);
			const usedAt = i < 2 ? daysFromEpoch(i + 1, 10) : null;
			const usedByDeviceId =
				i < 2 ? `demo-device-${String(i + 1).padStart(2, "0")}` : null;
			await tx
				.insert(deviceEnrolmentTokens)
				.values({
					id,
					tokenHash,
					createdBy,
					expiresAt,
					usedAt,
					usedByDeviceId,
					createdAt,
				})
				.onConflictDoNothing();
		}

		// Device commands — ~12 across devices
		const commandTools = [
			"collect_logs",
			"run_script",
			"check_disk",
			"install_package",
		];
		for (let i = 0; i < 12; i++) {
			const id = `demo-device-cmd-${String(i + 1).padStart(2, "0")}`;
			const deviceId = `demo-device-${String((i % 10) + 1).padStart(2, "0")}`;

			// Ensure unique per device: use i as sequence for simplicity distinct per device due to sparse use
			const seqForDevice = i + 1;
			const tool = commandTools[i % commandTools.length]!;
			const status =
				i % 4 === 0
					? "succeeded"
					: i % 4 === 1
						? "pending"
						: i % 4 === 2
							? "failed"
							: "dispatched";
			const createdAt = daysFromEpoch(10 + i, 11);
			const dispatchedAt =
				status !== "pending" ? daysFromEpoch(10 + i, 11 + 0.2) : null;
			const completedAt =
				status === "succeeded" || status === "failed"
					? daysFromEpoch(10 + i, 12)
					: null;
			await tx
				.insert(deviceCommands)
				.values({
					id,
					deviceId,
					sequence: seqForDevice,
					tool,
					input: { target: hostnameForDevice(deviceId), demo: true },
					status: status as typeof deviceCommands.$inferInsert.status,
					output: status === "succeeded" ? { result: "ok", demo: true } : null,
					error: status === "failed" ? "simulated failure for demo" : null,
					createdAt,
					dispatchedAt,
					completedAt,
				})
				.onConflictDoNothing();
		}

		// Device command proposals — 4 (2 pending) — need tickets; fallback to demo-ticket ids if tickets not yet seeded?
		// We insert proposals after tickets in demo order, but this module runs before tickets.
		// So we defer: insert proposals with dummy ticketIds that will match later seeded tickets (first 4 demo tickets).
		// To keep FK optional? ticket_id is NOT NULL but no FK constraint to tickets? Check schema — it is not FK.
		// Actually device_command_proposals has ticket_id NOT NULL but no FK references clause? Schema shows no reference, just text.
		// So safe to insert now with future ticket ids.
		for (let i = 0; i < 4; i++) {
			const id = `demo-proposal-${String(i + 1).padStart(2, "0")}`;
			const deviceId = `demo-device-${String(i + 1).padStart(2, "0")}`;
			// These ticket ids will be created by tickets.ts as demo ticket numbers; but deviceCommandProposals.ticketId is just text
			// We'll map to deterministic future ticket CUIDs? Better use demo-ticket-future ids that tickets module also uses as internal CUID?
			// Since tickets uses random UUID for id, we cannot know ahead. So for demo we use placeholder like pending ticket relation will be loose.
			// Alternative: postpone proposal seeding to after tickets. For now insert with a seeded ticket id we also seed manually without createTicket.
			// Simplest: create a placeholder ticket id string that suggests relation but not FK-enforced.
			const ticketId = `demo-ticket-proposal-${String(i + 1).padStart(2, "0")}`;
			const status = i < 2 ? "proposed" : i === 2 ? "approved" : "rejected";
			const requestedById = DEMO_USERS[0]!.id;
			const approvedById = status !== "proposed" ? DEMO_USERS[1]!.id : null;
			const decidedAt =
				status !== "proposed" ? daysFromEpoch(15 + i, 14) : null;
			const expiresAt = daysFromEpoch(30 + i, 9);
			const createdAt = daysFromEpoch(12 + i, 10);
			const command = [
				"powershell.exe",
				"-ExecutionPolicy",
				"Bypass",
				"-File",
				`demo-script-${i + 1}.ps1`,
			];
			const digest = createHash("sha256")
				.update(JSON.stringify(command))
				.digest("hex");
			await tx
				.insert(deviceCommandProposals)
				.values({
					id,
					deviceId,
					ticketId,
					command,
					digest,
					requestedById,
					reason: `Demo proposal ${i + 1}: routine maintenance via device command`,
					status: status as typeof deviceCommandProposals.$inferInsert.status,
					approvedById,
					decidedAt,
					decisionNote:
						status !== "proposed"
							? status === "approved"
								? "Approved for demo"
								: "Rejected - not needed"
							: null,
					expiresAt,
					createdAt,
				})
				.onConflictDoNothing();
		}
	});

	console.log(
		"[seed:assets-devices] seeded asset statuses, assets, devices, tokens, commands, proposals",
	);
}

function hostnameForDevice(deviceId: string): string {
	const num = Number.parseInt(deviceId.replace("demo-device-", ""), 10);
	const hosts = [
		"ENG-LT-001",
		"ENG-LT-002",
		"ENG-LT-003",
		"SALES-LT-042",
		"SALES-LT-043",
		"FIN-LT-010",
		"FIN-LT-011",
		"IT-LT-001",
		"IT-LT-002",
		"IT-LT-003",
		"IT-LT-004",
		"HR-LT-005",
		"OPS-LT-020",
		"SUPPORT-LT-007",
		"QA-LT-012",
	];
	return hosts[(num - 1) % hosts.length] ?? "UNKNOWN";
}
