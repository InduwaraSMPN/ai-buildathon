import { eq } from "drizzle-orm";

import { db } from "@/db";
import { teamMembers } from "@/db/schema/org";
import {
	roleCapabilities,
	roleGrants,
	roles,
	teamRoles,
	userRoles,
} from "@/db/schema/rbac";
import type { Capability, UserKind } from "@/shared";

export async function assignDefaultReporterRole(
	userId: string,
	kind: UserKind,
): Promise<void> {
	if (kind !== "reporter") return;
	const employee = (
		await db
			.select({ id: roles.id })
			.from(roles)
			.where(eq(roles.name, "Employee"))
			.limit(1)
	)[0];
	if (!employee) throw new Error("Seeded Employee role is missing");
	await db.transaction(async (tx) => {
		const inserted = await tx
			.insert(userRoles)
			.values({ userId, roleId: employee.id })
			.onConflictDoNothing()
			.returning({ userId: userRoles.userId });
		if (inserted[0])
			await tx.insert(roleGrants).values({
				id: crypto.randomUUID(),
				action: "grant",
				roleId: employee.id,
				roleName: "Employee",
				targetType: "user",
				targetId: userId,
			});
	});
}

export async function resolveCapabilities(
	userId: string,
): Promise<Set<Capability>> {
	const [direct, team] = await Promise.all([
		db
			.select({ capability: roleCapabilities.capability })
			.from(userRoles)
			.innerJoin(
				roleCapabilities,
				eq(userRoles.roleId, roleCapabilities.roleId),
			)
			.where(eq(userRoles.userId, userId)),
		db
			.select({ capability: roleCapabilities.capability })
			.from(teamMembers)
			.innerJoin(teamRoles, eq(teamMembers.teamId, teamRoles.teamId))
			.innerJoin(
				roleCapabilities,
				eq(teamRoles.roleId, roleCapabilities.roleId),
			)
			.where(eq(teamMembers.userId, userId)),
	]);
	return new Set([...direct, ...team].map(({ capability }) => capability));
}

export const hasEveryCapability = (
	capabilities: ReadonlySet<Capability>,
	required: readonly Capability[],
) => required.every((capability) => capabilities.has(capability));
