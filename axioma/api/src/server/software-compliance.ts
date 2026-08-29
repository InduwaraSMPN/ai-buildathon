export type LicenceEntitlement = {
	id: string;
	productId: string;
	seatCount: number;
	validFrom?: Date | null;
	expiresAt?: Date | null;
};

export type LicenceAllocation = {
	entitlementId: string;
	assetId?: string | null;
	userId?: string | null;
	revokedAt?: Date | null;
};

export type SoftwareInstall = {
	productId: string;
	assetId: string;
	userId?: string | null;
};

const activeAt = (entitlement: LicenceEntitlement, at: Date) =>
	(!entitlement.validFrom || entitlement.validFrom <= at) &&
	(!entitlement.expiresAt || entitlement.expiresAt >= at);

export function assessSoftwareCompliance(
	installs: readonly SoftwareInstall[],
	entitlements: readonly LicenceEntitlement[],
	allocations: readonly LicenceAllocation[],
	at = new Date(),
) {
	const byId = new Map(
		entitlements.map((entitlement) => [entitlement.id, entitlement]),
	);
	const activeAllocations = allocations.filter(
		(allocation) => !allocation.revokedAt || allocation.revokedAt > at,
	);
	const usedSeats = new Map<string, number>();
	for (const allocation of activeAllocations) {
		usedSeats.set(
			allocation.entitlementId,
			(usedSeats.get(allocation.entitlementId) ?? 0) + 1,
		);
	}

	const overAllocatedEntitlementIds = entitlements
		.filter(
			(entitlement) =>
				(usedSeats.get(entitlement.id) ?? 0) > entitlement.seatCount,
		)
		.map((entitlement) => entitlement.id);

	const installResults = installs.map((install) => {
		const allocation = activeAllocations.find((candidate) => {
			const entitlement = byId.get(candidate.entitlementId);
			return (
				entitlement?.productId === install.productId &&
				(candidate.assetId === install.assetId ||
					(!!install.userId && candidate.userId === install.userId))
			);
		});
		const entitlement = allocation
			? byId.get(allocation.entitlementId)
			: undefined;
		const status: "unlicensed" | "expired" | "over-allocated" | "compliant" = !entitlement
			? "unlicensed"
			: !activeAt(entitlement, at)
				? "expired"
				: overAllocatedEntitlementIds.includes(entitlement.id)
					? "over-allocated"
					: "compliant";
		return { ...install, entitlementId: entitlement?.id ?? null, status };
	});

	return { installResults, overAllocatedEntitlementIds };
}
