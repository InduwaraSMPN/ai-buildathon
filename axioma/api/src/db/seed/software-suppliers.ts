/**
 * Suppliers, contracts, coverage windows, software products, entitlements, allocations.
 * Depends on users (for allocations).
 */

import { db } from "@/db";
import {
	softwareLicenceAllocations,
	softwareLicenceEntitlements,
	softwareProducts,
} from "@/db/schema/software-licences";
import {
	contractCoverageWindows,
	contracts,
	suppliers,
} from "@/db/schema/suppliers";
import {
	DEMO_USERS,
	daysFromEpoch,
	SOFTWARE_PRODUCTS,
	SUPPLIERS,
} from "./data";

export async function seedSoftwareSuppliers(): Promise<void> {
	await db.transaction(async (tx) => {
		// Suppliers
		for (const sup of SUPPLIERS) {
			await tx
				.insert(suppliers)
				.values({
					id: sup.id,
					name: sup.name,
					contactName: sup.contactName,
					contactEmail: sup.contactEmail,
					active: true,
					createdAt: daysFromEpoch(1, 9),
					updatedAt: daysFromEpoch(1, 9),
				})
				.onConflictDoNothing();
		}

		// Contracts — 5 contracts
		const contractDefs = [
			{
				id: "demo-contract-01",
				supplierId: "demo-supplier-01",
				serviceId: "svc-infrastructure",
				name: "Acme Cloud — Production Hosting",
				reference: "CC-ACME-2026-001",
				startsOn: "2026-01-01",
				endsOn: "2026-12-31",
			},
			{
				id: "demo-contract-02",
				supplierId: "demo-supplier-02",
				serviceId: "svc-device",
				name: "Global Hardware — Laptop Fleet",
				reference: "GHW-2026-042",
				startsOn: "2026-03-01",
				endsOn: "2027-02-28",
			},
			{
				id: "demo-contract-03",
				supplierId: "demo-supplier-03",
				serviceId: "svc-infrastructure",
				name: "SecureCorp — SOC Monitoring",
				reference: "SC-SOC-2026-09",
				startsOn: "2026-06-01",
				endsOn: null,
			},
			{
				id: "demo-contract-04",
				supplierId: "demo-supplier-01",
				serviceId: "svc-infrastructure",
				name: "Acme Cloud — Staging",
				reference: "CC-ACME-2026-002",
				startsOn: "2026-02-15",
				endsOn: "2026-12-31",
			},
			{
				id: "demo-contract-05",
				supplierId: "demo-supplier-04",
				serviceId: "svc-general",
				name: "DataFlow — Integration Support",
				reference: "DF-2026-011",
				startsOn: "2026-04-01",
				endsOn: "2026-10-31",
			},
		];
		for (const c of contractDefs) {
			await tx
				.insert(contracts)
				.values({
					id: c.id,
					supplierId: c.supplierId,
					serviceId: c.serviceId,
					name: c.name,
					reference: c.reference,
					startsOn: c.startsOn,
					endsOn: c.endsOn,
					active: true,
					createdAt: daysFromEpoch(2, 9),
					updatedAt: daysFromEpoch(2, 9),
				})
				.onConflictDoNothing();
		}

		// Coverage windows — pick one SLA (default-sla) and create windows for contract 01
		// Baseline SLA id is default-sla
		const coverageWindows = [
			{ id: "demo-coverage-01", contractId: "demo-contract-01", weekday: 1 },
			{ id: "demo-coverage-02", contractId: "demo-contract-01", weekday: 2 },
			{ id: "demo-coverage-03", contractId: "demo-contract-01", weekday: 3 },
			{ id: "demo-coverage-04", contractId: "demo-contract-01", weekday: 4 },
			{ id: "demo-coverage-05", contractId: "demo-contract-01", weekday: 5 },
		];
		for (const w of coverageWindows) {
			await tx
				.insert(contractCoverageWindows)
				.values({
					id: w.id,
					contractId: w.contractId,
					slaId: "default-sla",
					timezone: "UTC",
					weekday: w.weekday,
					startMinute: 540, // 09:00
					endMinute: 1020, // 17:00
					priority: 0,
				})
				.onConflictDoNothing();
		}

		// Software products — 5
		for (const p of SOFTWARE_PRODUCTS) {
			await tx
				.insert(softwareProducts)
				.values({
					id: p.id,
					name: p.name,
					publisher: p.publisher,
					identityKey: p.identityKey,
					createdAt: daysFromEpoch(1, 9),
				})
				.onConflictDoNothing();
		}

		// Entitlements — 1 per product (some with 2)
		const entitlementDefs = [
			{
				id: "demo-entitlement-01",
				productId: "demo-sw-01",
				seatCount: 100,
				licenceKey: "M365-E5-DEMO-001",
				validFrom: daysFromEpoch(-30),
				expiresAt: daysFromEpoch(335),
			},
			{
				id: "demo-entitlement-02",
				productId: "demo-sw-01",
				seatCount: 25,
				licenceKey: "M365-E5-DEMO-002",
				validFrom: daysFromEpoch(-10),
				expiresAt: daysFromEpoch(355),
			},
			{
				id: "demo-entitlement-03",
				productId: "demo-sw-02",
				seatCount: 20,
				licenceKey: "ADOBE-CC-DEMO-001",
				validFrom: daysFromEpoch(-20),
				expiresAt: daysFromEpoch(345),
			},
			{
				id: "demo-entitlement-04",
				productId: "demo-sw-03",
				seatCount: 50,
				licenceKey: null,
				validFrom: daysFromEpoch(-15),
				expiresAt: daysFromEpoch(350),
			},
			{
				id: "demo-entitlement-05",
				productId: "demo-sw-04",
				seatCount: 30,
				licenceKey: "JB-ALL-DEMO-001",
				validFrom: daysFromEpoch(-40),
				expiresAt: daysFromEpoch(325),
			},
			{
				id: "demo-entitlement-06",
				productId: "demo-sw-05",
				seatCount: 100,
				licenceKey: "CS-FALCON-DEMO-001",
				validFrom: daysFromEpoch(-25),
				expiresAt: daysFromEpoch(340),
			},
		];
		for (const e of entitlementDefs) {
			await tx
				.insert(softwareLicenceEntitlements)
				.values({
					id: e.id,
					productId: e.productId,
					licenceKey: e.licenceKey,
					seatCount: e.seatCount,
					validFrom: e.validFrom,
					expiresAt: e.expiresAt,
					createdAt: daysFromEpoch(1, 9),
				})
				.onConflictDoNothing();
		}

		// Allocations — ~25 allocations, mixture of user and asset targets
		// First 15: user allocations round-robin across demo users
		for (let i = 0; i < 15; i++) {
			const id = `demo-alloc-${String(i + 1).padStart(2, "0")}`;
			const entitlementId = entitlementDefs[i % entitlementDefs.length]!.id;
			const userId = DEMO_USERS[i % DEMO_USERS.length]!.id;
			await tx
				.insert(softwareLicenceAllocations)
				.values({
					id,
					entitlementId,
					userId,
					assetId: null,
					allocatedAt: daysFromEpoch(5 + i, 9),
					revokedAt: i % 7 === 6 ? daysFromEpoch(20 + i, 9) : null,
				})
				.onConflictDoNothing();
		}
		// Next 10: asset allocations
		for (let i = 0; i < 10; i++) {
			const id = `demo-alloc-${String(16 + i).padStart(2, "0")}`;
			const entitlementId = entitlementDefs[i % entitlementDefs.length]!.id;
			const assetId = `demo-asset-${String((i % 10) + 1).padStart(2, "0")}`;
			await tx
				.insert(softwareLicenceAllocations)
				.values({
					id,
					entitlementId,
					assetId,
					userId: null,
					allocatedAt: daysFromEpoch(6 + i, 9),
					revokedAt: null,
				})
				.onConflictDoNothing();
		}
	});

	console.log(
		"[seed:software-suppliers] seeded suppliers, contracts, coverage, software, entitlements, allocations",
	);
}
