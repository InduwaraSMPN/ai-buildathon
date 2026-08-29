import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import {
	assetDevices,
	assetDisks,
	assetHardware,
	assets,
	devices,
	inventoryReports,
	softwareInventoryApps,
} from "@/db/schema";

type Result = { ok?: boolean; data?: unknown; raw?: string };
type Inventory = { disks?: Result; hardware?: Result; software?: Result };

export const MAX_INVENTORY_CLOCK_SKEW_MS = 5 * 60_000;

export function parseInventoryReport(
	report: Record<string, unknown>,
	now = Date.now(),
) {
	const id = String(report.reportId ?? "").trim();
	const reportedAt = new Date(Number(report.collectedUnixMs));
	if (
		!id ||
		Number.isNaN(reportedAt.getTime()) ||
		reportedAt.getTime() > now + MAX_INVENTORY_CLOCK_SKEW_MS
	)
		throw new Error("invalid inventory report metadata");
	let payload: Inventory;
	try {
		payload = JSON.parse(String(report.inventoryJson)) as Inventory;
	} catch {
		throw new Error("invalid inventory report JSON");
	}
	if (!payload || typeof payload !== "object")
		throw new Error("invalid inventory report payload");
	return { id, reportedAt, payload };
}

const text = (value: unknown) =>
	value == null || value === "" ? null : String(value);
const array = (value: unknown) => (Array.isArray(value) ? value : []);
const object = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
const identityKey = (app: Record<string, unknown>) =>
	[app.name, app.version, app.publisher]
		.map((value) =>
			String(value ?? "")
				.trim()
				.toLowerCase(),
		)
		.join("\0");

export async function ingestInventoryReport(
	deviceId: string,
	raw: Record<string, unknown>,
) {
	const report = parseInventoryReport(raw);
	await db.transaction(async (tx) => {
		const device = (
			await tx
				.select({ hostname: devices.hostname, ownerId: devices.ownerId })
				.from(devices)
				.where(eq(devices.id, deviceId))
				.limit(1)
		)[0];
		if (!device) throw new Error("inventory device is not registered");
		if (!device.ownerId) throw new Error("inventory device is not claimed");

		const linkId = `device:${deviceId}`;
		await tx
			.insert(assets)
			.values({ id: linkId, name: device.hostname })
			.onConflictDoNothing({ target: assets.id });
		await tx
			.insert(assetDevices)
			.values({
				id: linkId,
				assetId: linkId,
				deviceId,
				lastReportedAt: report.reportedAt,
			})
			.onConflictDoNothing({ target: assetDevices.deviceId });
		const link = (
			await tx
				.select({
					id: assetDevices.id,
					lastReportedAt: assetDevices.lastReportedAt,
				})
				.from(assetDevices)
				.where(eq(assetDevices.deviceId, deviceId))
				.limit(1)
		)[0];
		if (!link) throw new Error("inventory asset link is unavailable");

		const inserted = await tx
			.insert(inventoryReports)
			.values({
				id: report.id,
				assetDeviceId: link.id,
				payload: report.payload,
				reportedAt: report.reportedAt,
			})
			.onConflictDoNothing({ target: inventoryReports.id })
			.returning({ id: inventoryReports.id });
		if (!inserted[0] || link.lastReportedAt > report.reportedAt) return;
		await tx
			.update(assetDevices)
			.set({ lastReportedAt: report.reportedAt })
			.where(eq(assetDevices.id, link.id));

		if (report.payload.disks?.ok) {
			const disks = array(object(report.payload.disks.data).disks)
				.map(object)
				.filter((disk) => String(disk.device_id ?? ""));
			for (const disk of disks)
				await tx
					.insert(assetDisks)
					.values({
						id: crypto.randomUUID(),
						assetDeviceId: link.id,
						deviceKey: String(disk.device_id),
						model: text(disk.model),
						serialNumber: text(disk.serial_number),
						sizeBytes: text(disk.size_bytes),
						raw: report.payload.disks.raw,
						observedAt: report.reportedAt,
					})
					.onConflictDoUpdate({
						target: [assetDisks.assetDeviceId, assetDisks.deviceKey],
						set: {
							model: text(disk.model),
							serialNumber: text(disk.serial_number),
							sizeBytes: text(disk.size_bytes),
							raw: report.payload.disks.raw,
							observedAt: report.reportedAt,
						},
					});
			const keys = disks.map((disk) => String(disk.device_id));
			await tx
				.delete(assetDisks)
				.where(
					keys.length
						? and(
								eq(assetDisks.assetDeviceId, link.id),
								notInArray(assetDisks.deviceKey, keys),
							)
						: eq(assetDisks.assetDeviceId, link.id),
				);
		}
		if (report.payload.hardware?.ok) {
			const hardware = object(report.payload.hardware.data);
			const cpu =
				array(hardware.processors)
					.map((processor) => text(object(processor).name))
					.filter(Boolean)
					.join(", ") || null;
			await tx
				.insert(assetHardware)
				.values({
					id: crypto.randomUUID(),
					assetDeviceId: link.id,
					manufacturer: text(hardware.manufacturer),
					model: text(hardware.model),
					serialNumber: text(hardware.serial_number),
					cpu,
					memoryBytes: text(hardware.total_memory_bytes),
					biosVersion: text(hardware.bios_version),
					raw: report.payload.hardware.raw,
					observedAt: report.reportedAt,
				})
				.onConflictDoUpdate({
					target: assetHardware.assetDeviceId,
					set: {
						manufacturer: text(hardware.manufacturer),
						model: text(hardware.model),
						serialNumber: text(hardware.serial_number),
						cpu,
						memoryBytes: text(hardware.total_memory_bytes),
						biosVersion: text(hardware.bios_version),
						raw: report.payload.hardware.raw,
						observedAt: report.reportedAt,
					},
				});
		}
		if (report.payload.software?.ok) {
			const apps = array(object(report.payload.software.data).applications)
				.map(object)
				.filter((app) => String(app.name ?? ""));
			for (const app of apps) {
				const key = identityKey(app);
				await tx
					.insert(softwareInventoryApps)
					.values({
						id: crypto.randomUUID(),
						assetDeviceId: link.id,
						identityKey: key,
						name: String(app.name),
						version: text(app.version),
						publisher: text(app.publisher),
						installDate: text(app.install_date),
						raw: report.payload.software.raw,
						observedAt: report.reportedAt,
					})
					.onConflictDoUpdate({
						target: [
							softwareInventoryApps.assetDeviceId,
							softwareInventoryApps.identityKey,
						],
						set: {
							name: String(app.name),
							version: text(app.version),
							publisher: text(app.publisher),
							installDate: text(app.install_date),
							raw: report.payload.software.raw,
							observedAt: report.reportedAt,
						},
					});
			}
			const keys = apps.map(identityKey);
			await tx
				.delete(softwareInventoryApps)
				.where(
					keys.length
						? and(
								eq(softwareInventoryApps.assetDeviceId, link.id),
								notInArray(softwareInventoryApps.identityKey, keys),
							)
						: eq(softwareInventoryApps.assetDeviceId, link.id),
				);
		}
	});
}
