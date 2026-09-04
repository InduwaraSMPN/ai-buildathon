/**
 * Device inventory — asset↔device linkage plus the hardware, disk, installed
 * software and raw report rows behind `readDeviceInventory`.
 *
 * Without these the device detail sheet's inventory panel is empty even though
 * devices and assets both exist.
 */

import { db } from "@/db";
import {
	assetDevices,
	assetDisks,
	assetHardware,
	inventoryReports,
	softwareInventoryApps,
} from "@/db/schema/inventory";
import { softwareIdentityKey } from "@/server/inventory";
import { daysFromEpoch, INSTALLED_SOFTWARE } from "./data";

/** 15 devices are seeded; each maps onto the asset of the same ordinal. */
const DEVICE_COUNT = 15;

const HARDWARE = [
	{
		manufacturer: "Apple",
		model: "MacBook Pro 16-inch (M3 Max)",
		cpu: "Apple M3 Max (16-core)",
		memoryBytes: "68719476736",
		biosVersion: "10151.101.3",
	},
	{
		manufacturer: "Dell Inc.",
		model: "XPS 15 9530",
		cpu: "Intel Core i9-13900H",
		memoryBytes: "34359738368",
		biosVersion: "1.12.0",
	},
	{
		manufacturer: "LENOVO",
		model: "ThinkPad X1 Carbon Gen 11",
		cpu: "Intel Core i7-1365U",
		memoryBytes: "17179869184",
		biosVersion: "N3XET42W",
	},
	{
		manufacturer: "HP",
		model: "EliteBook 840 G10",
		cpu: "Intel Core i5-1345U",
		memoryBytes: "17179869184",
		biosVersion: "V85 Ver. 01.05.02",
	},
	{
		manufacturer: "Apple",
		model: "MacBook Air 13-inch (M2)",
		cpu: "Apple M2 (8-core)",
		memoryBytes: "17179869184",
		biosVersion: "8422.141.2",
	},
] as const;

const DISKS = [
	{ model: "APPLE SSD AP1024Z", size: "1024209543168" },
	{ model: "PC801 NVMe SK hynix 512GB", size: "512110190592" },
	{ model: "SAMSUNG MZVL21T0HCLR", size: "1024209543168" },
	{ model: "WD PC SN740 SDDPNQD-512G", size: "512110190592" },
	{ model: "KIOXIA KXG80ZNV1T02", size: "1024209543168" },
] as const;

export async function seedInventory(): Promise<void> {
	await db.transaction(async (tx) => {
		for (let i = 0; i < DEVICE_COUNT; i++) {
			const ordinal = String(i + 1).padStart(2, "0");
			const assetDeviceId = `demo-asset-device-${ordinal}`;
			const reportedAt = daysFromEpoch(20 + (i % 8), 7 + (i % 6));

			await tx
				.insert(assetDevices)
				.values({
					id: assetDeviceId,
					assetId: `demo-asset-${ordinal}`,
					deviceId: `demo-device-${ordinal}`,
					lastReportedAt: reportedAt,
				})
				.onConflictDoNothing();

			const hw = HARDWARE[i % HARDWARE.length]!;
			await tx
				.insert(assetHardware)
				.values({
					id: `demo-asset-hardware-${ordinal}`,
					assetDeviceId,
					manufacturer: hw.manufacturer,
					model: hw.model,
					serialNumber: `SN-${String(i + 1).padStart(6, "0")}`,
					cpu: hw.cpu,
					memoryBytes: hw.memoryBytes,
					biosVersion: hw.biosVersion,
					raw: null,
					observedAt: reportedAt,
				})
				.onConflictDoNothing();

			// One or two disks per device.
			const diskCount = i % 4 === 0 ? 2 : 1;
			for (let d = 0; d < diskCount; d++) {
				const disk = DISKS[(i + d) % DISKS.length]!;
				await tx
					.insert(assetDisks)
					.values({
						id: `demo-asset-disk-${ordinal}-${d + 1}`,
						assetDeviceId,
						deviceKey: d === 0 ? "disk0" : "disk1",
						model: disk.model,
						serialNumber: `DSK-${ordinal}-${d + 1}`,
						sizeBytes: disk.size,
						raw: null,
						observedAt: reportedAt,
					})
					.onConflictDoNothing();
			}

			// 5–8 installed applications per device. The identity key is derived
			// the way ingestInventoryReport derives it, so the compliance join
			// against software_products actually matches.
			const appCount = 5 + (i % 4);
			for (let a = 0; a < appCount; a++) {
				const app = INSTALLED_SOFTWARE[(i + a) % INSTALLED_SOFTWARE.length]!;
				await tx
					.insert(softwareInventoryApps)
					.values({
						id: `demo-sw-inventory-${ordinal}-${String(a + 1).padStart(2, "0")}`,
						assetDeviceId,
						identityKey: softwareIdentityKey(app.name, app.publisher),
						name: app.name,
						version: app.version,
						publisher: app.publisher,
						installDate: daysFromEpoch(a, 9).toISOString().slice(0, 10),
						raw: null,
						observedAt: reportedAt,
					})
					.onConflictDoNothing();
			}

			// The raw payload the agent posted, kept for the evidence view.
			await tx
				.insert(inventoryReports)
				.values({
					id: `demo-inventory-report-${ordinal}`,
					assetDeviceId,
					payload: {
						seeded: true,
						hostname: `demo-host-${ordinal}`,
						hardware: hw,
						diskCount,
						appCount,
						collectedAt: reportedAt.toISOString(),
					},
					reportedAt,
				})
				.onConflictDoNothing();
		}
	});

	console.log(
		"[seed:inventory] seeded asset↔device links, hardware, disks, installed software, reports",
	);
}
