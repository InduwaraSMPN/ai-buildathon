/**
 * Asset lifecycle — import profiles/runs/identities/rejections, change history,
 * checkout log.
 *
 * Backs the Assets screen's import, history and custody panels, which stay
 * empty when only the `assets` rows themselves are seeded.
 */

import { db } from "@/db";
import {
	assetCheckoutLog,
	assetHistory,
	assetImportIdentities,
	assetImportProfiles,
	assetImportRejections,
	assetImportRuns,
} from "@/db/schema/assets";
import { ASSET_NAMES, DEMO_USERS, daysFromEpoch } from "./data";

const PROFILES = [
	{
		id: "demo-import-profile-01",
		name: "Laptop fleet (CSV)",
		identityColumns: ["serial_number"],
		dynamicFieldColumns: {},
	},
	{
		id: "demo-import-profile-02",
		name: "Peripherals (supplier export)",
		identityColumns: ["asset_tag", "serial_number"],
		dynamicFieldColumns: {},
	},
] as const;

const RUNS = [
	{
		id: "demo-import-run-01",
		profileId: "demo-import-profile-01",
		fileName: "laptop-fleet-2026-08.csv",
		total: 24,
		accepted: 24,
		rejected: 0,
		day: 4,
	},
	{
		id: "demo-import-run-02",
		profileId: "demo-import-profile-01",
		fileName: "laptop-fleet-2026-08-delta.csv",
		total: 12,
		accepted: 9,
		rejected: 3,
		day: 11,
	},
	{
		id: "demo-import-run-03",
		profileId: "demo-import-profile-02",
		fileName: "peripherals-acme-export.csv",
		total: 18,
		accepted: 16,
		rejected: 2,
		day: 17,
	},
	{
		id: "demo-import-run-04",
		profileId: "demo-import-profile-02",
		fileName: "peripherals-dataflow-export.csv",
		total: 9,
		accepted: 8,
		rejected: 1,
		day: 24,
	},
] as const;

/** Row-level failures, one per rejected row across the runs above. */
const REJECTIONS = [
	{
		runId: "demo-import-run-02",
		rowNumber: 3,
		reason: "Missing serial_number — identity column cannot be blank",
		row: { asset_tag: "AX-0141", serial_number: "", model: "MacBook Pro 14" },
	},
	{
		runId: "demo-import-run-02",
		rowNumber: 7,
		reason: "Duplicate serial_number within the same file",
		row: {
			asset_tag: "AX-0147",
			serial_number: "C02XK1TPJGH5",
			model: "MacBook Pro 14",
		},
	},
	{
		runId: "demo-import-run-02",
		rowNumber: 11,
		reason: "Unknown status 'Loaner' — no matching asset status",
		row: {
			asset_tag: "AX-0151",
			serial_number: "C02XK9QQJGH5",
			status: "Loaner",
		},
	},
	{
		runId: "demo-import-run-03",
		rowNumber: 5,
		reason: "Malformed purchase_date '31/02/2026'",
		row: { asset_tag: "AX-0205", purchase_date: "31/02/2026" },
	},
	{
		runId: "demo-import-run-03",
		rowNumber: 14,
		reason: "Custodian email not found in directory",
		row: { asset_tag: "AX-0214", custodian: "leaver@axioma.demo" },
	},
	{
		runId: "demo-import-run-04",
		rowNumber: 6,
		reason: "Row exceeds column count — check delimiter",
		row: { raw: "AX-0233,Dock,Dell,WD19S,,,extra" },
	},
] as const;

const HISTORY_ACTIONS = [
	{ action: "created", changes: { source: "import" } },
	{ action: "status_changed", changes: { from: "Active", to: "In Repair" } },
	{ action: "custodian_assigned", changes: { from: null, to: "assigned" } },
	{ action: "updated", changes: { field: "location", to: "Floor 3" } },
	{ action: "status_changed", changes: { from: "In Repair", to: "Active" } },
	{ action: "custodian_released", changes: { from: "assigned", to: null } },
] as const;

export async function seedAssetLifecycle(): Promise<void> {
	const staff = DEMO_USERS.filter((u) => u.kind === "staff");
	const reporters = DEMO_USERS.filter((u) => u.kind === "reporter");

	await db.transaction(async (tx) => {
		for (const p of PROFILES) {
			await tx
				.insert(assetImportProfiles)
				.values({
					id: p.id,
					name: p.name,
					identityColumns: [...p.identityColumns],
					dynamicFieldColumns: p.dynamicFieldColumns,
					createdAt: daysFromEpoch(3, 9),
				})
				.onConflictDoNothing();
		}

		for (const r of RUNS) {
			await tx
				.insert(assetImportRuns)
				.values({
					id: r.id,
					profileId: r.profileId,
					fileName: r.fileName,
					totalRows: r.total,
					acceptedRows: r.accepted,
					rejectedRows: r.rejected,
					createdAt: daysFromEpoch(r.day, 10),
				})
				.onConflictDoNothing();
		}

		for (let i = 0; i < REJECTIONS.length; i++) {
			const rej = REJECTIONS[i]!;
			await tx
				.insert(assetImportRejections)
				.values({
					id: `demo-import-rejection-${String(i + 1).padStart(2, "0")}`,
					runId: rej.runId,
					rowNumber: rej.rowNumber,
					reason: rej.reason,
					row: rej.row,
				})
				.onConflictDoNothing();
		}

		// Import identities tie imported rows back to the assets they produced,
		// which is what makes a re-import update rather than duplicate.
		for (let i = 0; i < ASSET_NAMES.length; i++) {
			const assetId = `demo-asset-${String(i + 1).padStart(2, "0")}`;
			const profileId =
				i < 15 ? "demo-import-profile-01" : "demo-import-profile-02";
			await tx
				.insert(assetImportIdentities)
				.values({
					id: `demo-import-identity-${String(i + 1).padStart(2, "0")}`,
					profileId,
					identityKey: `SN-${String(i + 1).padStart(6, "0")}`,
					assetId,
				})
				.onConflictDoNothing();
		}

		// History: a few events per asset over the first 20 assets.
		let historyIndex = 0;
		for (let i = 0; i < 20; i++) {
			const assetId = `demo-asset-${String(i + 1).padStart(2, "0")}`;
			const eventCount = (i % 3) + 1;
			for (let e = 0; e < eventCount; e++) {
				historyIndex++;
				const event = HISTORY_ACTIONS[(i + e) % HISTORY_ACTIONS.length]!;
				const actor = staff[(i + e) % staff.length]!;
				await tx
					.insert(assetHistory)
					.values({
						id: `demo-asset-history-${String(historyIndex).padStart(3, "0")}`,
						assetId,
						action: event.action,
						actorId: actor.id,
						changes: event.changes,
						createdAt: daysFromEpoch(5 + i, 9 + e),
					})
					.onConflictDoNothing();
			}
		}

		// Checkout log: 12 custody records, the last few still checked out.
		for (let i = 0; i < 12; i++) {
			const assetId = `demo-asset-${String(i + 1).padStart(2, "0")}`;
			const custodian = reporters[i % reporters.length]!;
			const stillOut = i >= 8;
			await tx
				.insert(assetCheckoutLog)
				.values({
					id: `demo-asset-checkout-${String(i + 1).padStart(2, "0")}`,
					assetId,
					custodianId: custodian.id,
					checkedOutAt: daysFromEpoch(6 + i, 9),
					checkedInAt: stillOut ? null : daysFromEpoch(6 + i + 4, 16),
					note: stillOut
						? "Issued for daily use — still with custodian"
						: "Returned to stock after project completion",
				})
				.onConflictDoNothing();
		}
	});

	console.log(
		"[seed:asset-lifecycle] seeded import profiles/runs/identities/rejections, history, checkout log",
	);
}
