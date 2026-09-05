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

/**
 * How far ahead of the seed run the demo proposals expire. Each one is offset a
 * further day beyond this so the queue does not empty all at once.
 */
const PROPOSAL_EXPIRY_DAYS = 30;

/**
 * Plain English, because this text is read aloud off the approval screen. A
 * reason a person cannot evaluate is not an authorisation prompt.
 */
const DEMO_PROPOSAL_REASONS = [
	"Outlook profile is corrupt and the typed repair actions did not clear it; this rebuilds the profile in place.",
	"Print spooler is wedged and holding four jobs; restarting it is the documented repair and no typed action covers it.",
	"Certificate store is missing the new internal root, which is why the intranet fails to load.",
	"Disk cleanup on a laptop at 98% full, after the typed temp-file action recovered too little.",
];

/**
 * The argument vector each reason above asks for, one to one. An approver reads
 * this off the screen and decides, so it has to be the command that does the
 * described repair and nothing else: `powershell.exe -ExecutionPolicy Bypass
 * -File demo-script-1.ps1` said only "run an unnamed script with the guard
 * rails off", which is a reason to refuse rather than an authorisation prompt.
 */
const DEMO_PROPOSAL_COMMANDS: readonly (readonly string[])[] = [
	[
		"powershell.exe",
		"-NoProfile",
		"-NonInteractive",
		"-Command",
		'Remove-Item -LiteralPath "$env:LOCALAPPDATA\\Microsoft\\Outlook\\corrupt.ost" -Force',
	],
	[
		"powershell.exe",
		"-NoProfile",
		"-NonInteractive",
		"-Command",
		"Restart-Service -Name Spooler -Force",
	],
	["certutil.exe", "-user", "-addstore", "Root", "internal-root-2026.cer"],
	["cleanmgr.exe", "/sagerun:1"],
];

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

		// Device commands — ~12 across devices. Act 3 ends on this list, one
		// screen after the audience watched the real tools run, so an invented
		// tool name here reads as a capability that does not exist. Every entry
		// names a tool in the registry and carries that tool's real input.
		const commandCalls = [
			{
				tool: "device_read_state",
				input: { facets: ["resolver", "adapters"] },
				output: { resolver: { ok: true, data: { cached_entries: 12 } } },
			},
			{
				tool: "device_run_action",
				input: { action: "flush_dns", parameters: {} },
				output: { ok: true },
			},
			{
				tool: "device_read_state",
				input: { facets: ["storage"] },
				output: { storage: { ok: true, data: { free_bytes: 8_589_934_592 } } },
			},
			{
				tool: "device_run_action",
				input: { action: "clear_temp_files", parameters: {} },
				output: { ok: true },
			},
		];
		for (let i = 0; i < 12; i++) {
			const id = `demo-device-cmd-${String(i + 1).padStart(2, "0")}`;
			const deviceId = `demo-device-${String((i % 10) + 1).padStart(2, "0")}`;

			// Ensure unique per device: use i as sequence for simplicity distinct per device due to sparse use
			const seqForDevice = i + 1;
			const call = commandCalls[i % commandCalls.length]!;
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
					tool: call.tool,
					input: { device_id: deviceId, ...call.input },
					status: status as typeof deviceCommands.$inferInsert.status,
					output: status === "succeeded" ? call.output : null,
					error:
						status === "failed"
							? "the device did not answer within the read timeout"
							: null,
					createdAt,
					dispatchedAt,
					completedAt,
				})
				.onConflictDoNothing();
		}

		// Device command proposals — four, two of them still awaiting a decision.
		// `ticket_id` is text with no foreign key, which is what lets these be
		// written here even though this module runs before tickets are seeded.
		for (let i = 0; i < 4; i++) {
			const id = `demo-proposal-${String(i + 1).padStart(2, "0")}`;
			const deviceId = `demo-device-${String(i + 1).padStart(2, "0")}`;
			const ticketId = `demo-ticket-proposal-${String(i + 1).padStart(2, "0")}`;
			const status = i < 2 ? "proposed" : i === 2 ? "approved" : "rejected";
			const requestedById = DEMO_USERS[0]!.id;
			const approvedById = status !== "proposed" ? DEMO_USERS[1]!.id : null;
			const decidedAt =
				status !== "proposed" ? daysFromEpoch(15 + i, 14) : null;
			// Every proposal expires ahead of now, not at a fixed date in the seed's
			// own timeline. `expireStaleProposals` runs on every list call and
			// expires anything still `proposed` or `approved`, so a backdated
			// expiry both emptied the pending queue — no Approve or Reject to point
			// at — and rewrote the approved row to `expired`, which then showed as
			// expired and "Decided by Jamie Chen" on the same card.
			//
			// The window is a month rather than the few days it was, because these
			// rows are inserted with `onConflictDoNothing`: re-running the seed does
			// not refresh an expiry that has already passed, so a short window
			// silently empties the approval queue some days after the first seed and
			// nothing short of deleting the rows brings it back.
			const expiresAt = new Date(
				Date.now() + (PROPOSAL_EXPIRY_DAYS + i) * 24 * 60 * 60_000,
			);
			const createdAt = daysFromEpoch(12 + i, 10);
			const command = DEMO_PROPOSAL_COMMANDS[i] ?? [
				"powershell.exe",
				"-NoProfile",
				"-NonInteractive",
				"-Command",
				"Get-Service -Name Spooler",
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
					reason:
						DEMO_PROPOSAL_REASONS[i] ?? "Routine maintenance on this device",
					status: status as typeof deviceCommandProposals.$inferInsert.status,
					approvedById,
					decidedAt,
					// A decision note is read by whoever audits the decision later, so
					// it says what was decided and why, the way the approver would
					// have written it. "Approved for demo" said nothing.
					decisionNote:
						status !== "proposed"
							? status === "approved"
								? "Root is the published internal CA and the thumbprint matches the PKI page. Approved."
								: "The laptop is due for replacement this week; cleanmgr will not help and the disk is being reimaged anyway."
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
