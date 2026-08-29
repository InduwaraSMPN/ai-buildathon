import assert from "node:assert/strict";
import test from "node:test";
import { assessSoftwareCompliance } from "./software-compliance";

const at = new Date("2026-01-15T00:00:00Z");
const entitlements = [
	{
		id: "valid",
		productId: "office",
		seatCount: 1,
		expiresAt: new Date("2027-01-01T00:00:00Z"),
	},
	{
		id: "expired",
		productId: "vpn",
		seatCount: 2,
		expiresAt: new Date("2025-01-01T00:00:00Z"),
	},
];

test("matches installs to asset or user allocations and detects expiry", () => {
	const result = assessSoftwareCompliance(
		[
			{ productId: "office", assetId: "asset-1" },
			{ productId: "vpn", assetId: "asset-2", userId: "user-2" },
			{ productId: "editor", assetId: "asset-3" },
		],
		entitlements,
		[
			{ entitlementId: "valid", assetId: "asset-1" },
			{ entitlementId: "expired", userId: "user-2" },
		],
		at,
	);
	assert.deepEqual(
		result.installResults.map(({ entitlementId, status }) => ({
			entitlementId,
			status,
		})),
		[
			{ entitlementId: "valid", status: "compliant" },
			{ entitlementId: "expired", status: "expired" },
			{ entitlementId: null, status: "unlicensed" },
		],
	);
});

test("reports allocations beyond purchased seats", () => {
	const result = assessSoftwareCompliance(
		[{ productId: "office", assetId: "asset-1" }],
		entitlements,
		[
			{ entitlementId: "valid", assetId: "asset-1" },
			{ entitlementId: "valid", userId: "user-2" },
		],
		at,
	);
	assert.deepEqual(result.overAllocatedEntitlementIds, ["valid"]);
	assert.equal(result.installResults[0]?.status, "over-allocated");
});

test("ignores revoked allocations", () => {
	const result = assessSoftwareCompliance(
		[{ productId: "office", assetId: "asset-1" }],
		entitlements,
		[
			{
				entitlementId: "valid",
				assetId: "asset-1",
				revokedAt: new Date("2026-01-01T00:00:00Z"),
			},
		],
		at,
	);
	assert.equal(result.installResults[0]?.status, "unlicensed");
});
