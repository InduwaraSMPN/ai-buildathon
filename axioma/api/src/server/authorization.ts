import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { teamMembers } from "@/db/schema/org";
import {
	roleCapabilities,
	roleGrants,
	roles,
	teamRoles,
	userRoles,
} from "@/db/schema/rbac";
import type { Capability, UserKind } from "@/shared";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function assignDefaultRoleIn(
	tx: Transaction,
	userId: string,
	kind: UserKind,
	actorId?: string,
): Promise<void> {
	const roleName = kind === "staff" ? "IT Analyst" : "Employee";
	const role = (
		await tx
			.select({ id: roles.id })
			.from(roles)
			.where(eq(roles.name, roleName))
			.limit(1)
	)[0];
	if (!role) throw new Error(`Seeded ${roleName} role is missing`);
	const inserted = await tx
		.insert(userRoles)
		.values({ userId, roleId: role.id })
		.onConflictDoNothing()
		.returning({ userId: userRoles.userId });
	if (inserted[0])
		await tx.insert(roleGrants).values({
			id: crypto.randomUUID(),
			action: "grant",
			roleId: role.id,
			roleName,
			targetType: "user",
			targetId: userId,
			actorId,
		});
}

export const assignDefaultRole = (
	userId: string,
	kind: UserKind,
	actorId?: string,
) => db.transaction((tx) => assignDefaultRoleIn(tx, userId, kind, actorId));

export async function bootstrapAdministrator(email: string): Promise<boolean> {
	return db.transaction(async (tx) => {
		const account = (
			await tx
				.select({ id: user.id })
				.from(user)
				.where(eq(user.email, email))
				.limit(1)
		)[0];
		if (!account) return false;
		const role = (
			await tx
				.select({ id: roles.id })
				.from(roles)
				.where(eq(roles.name, "Platform Engineer"))
				.limit(1)
		)[0];
		if (!role) throw new Error("Seeded Platform Engineer role is missing");
		await tx.update(user).set({ kind: "staff" }).where(eq(user.id, account.id));
		const inserted = await tx
			.insert(userRoles)
			.values({ userId: account.id, roleId: role.id })
			.onConflictDoNothing()
			.returning({ userId: userRoles.userId });
		if (inserted[0])
			await tx.insert(roleGrants).values({
				id: crypto.randomUUID(),
				action: "grant",
				roleId: role.id,
				roleName: "Platform Engineer",
				targetType: "user",
				targetId: account.id,
			});
		return true;
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

export const LAST_ADMIN_CONFLICT = "LAST_ADMIN_REQUIRED";

export async function assertAdministratorRemains(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtext('axioma-admin-roles'))`,
	);
	const result = await tx.execute(sql`
		select count(distinct admins.user_id)::int as count
		from (
			select ur.user_id
			from user_roles ur
			join role_capabilities rc on rc.role_id = ur.role_id
			join "user" u on u.id = ur.user_id and u.kind = 'staff'
			where rc.capability = 'admin.roles'
			union
			select tm.user_id
			from team_members tm
			join team_roles tr on tr.team_id = tm.team_id
			join role_capabilities rc on rc.role_id = tr.role_id
			join "user" u on u.id = tm.user_id and u.kind = 'staff'
			where rc.capability = 'admin.roles'
		) admins
	`);
	if (Number(result.rows[0]?.count ?? 0) === 0)
		throw new Error(LAST_ADMIN_CONFLICT);
}

export const hasEveryCapability = (
	capabilities: ReadonlySet<Capability>,
	required: readonly Capability[],
) => required.every((capability) => capabilities.has(capability));
