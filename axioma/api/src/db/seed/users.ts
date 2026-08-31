/**
 * Departments, teams, departmentTeams, users, teamMembers, role assignment.
 *
 * Idempotent: every row uses a fixed id from data.ts and .onConflictDoNothing().
 * No account/password rows — display-only identities (documented).
 * Must run first (FK dependencies).
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import {
	departments,
	departmentTeams,
	teamMembers,
	teams,
} from "@/db/schema/org";
import { roleGrants, roles, userRoles } from "@/db/schema/rbac";
import {
	assertAdministratorRemains,
	assignDefaultRoleIn,
} from "@/server/authorization";
import { DEMO_USERS, DEPARTMENT_TEAMS, DEPARTMENTS, TEAMS } from "./data";

// Transaction type — avoid complex generic parsing that trips esbuild in this file
type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

export async function seedUsers(): Promise<void> {
	await db.transaction(async (tx) => {
		for (const dept of DEPARTMENTS) {
			await tx
				.insert(departments)
				.values({ id: dept.id, name: dept.name })
				.onConflictDoNothing();
		}
		for (const team of TEAMS) {
			await tx
				.insert(teams)
				.values({ id: team.id, name: team.name })
				.onConflictDoNothing();
		}
		for (const link of DEPARTMENT_TEAMS) {
			await tx
				.insert(departmentTeams)
				.values({ departmentId: link.departmentId, teamId: link.teamId })
				.onConflictDoNothing();
		}

		// Managers before reports so managerId FK succeeds
		const orderedUsers = [...DEMO_USERS].sort((a, b) => {
			if (a.managerId && !b.managerId) return 1;
			if (!a.managerId && b.managerId) return -1;
			return 0;
		});

		for (const u of orderedUsers) {
			await tx
				.insert(user)
				.values({
					id: u.id,
					name: u.name,
					email: u.email,
					emailVerified: true,
					kind: u.kind,
					jobTitle: u.jobTitle,
					managerId: u.managerId ?? null,
				})
				.onConflictDoNothing();

			if (u.id === "demo-user-platform-01") {
				// Platform Engineer directly (covers admin.roles), not IT Analyst
				const platformRole = (
					await tx
						.select({ id: roles.id })
						.from(roles)
						.where(eq(roles.name, "Platform Engineer"))
						.limit(1)
				)[0];
				if (platformRole) {
					const inserted = await tx
						.insert(userRoles)
						.values({ userId: u.id, roleId: platformRole.id })
						.onConflictDoNothing()
						.returning({ userId: userRoles.userId });
					if (inserted[0]) {
						await tx.insert(roleGrants).values({
							id: crypto.randomUUID(),
							action: "grant",
							roleId: platformRole.id,
							roleName: "Platform Engineer",
							targetType: "user",
							targetId: u.id,
						});
					}
				}
			} else {
				await assignDefaultRoleIn(tx as unknown as Tx, u.id, u.kind);
			}

			if (u.teamId) {
				await tx
					.insert(teamMembers)
					.values({ teamId: u.teamId, userId: u.id })
					.onConflictDoNothing();
			}
		}

		await assertAdministratorRemains(tx as unknown as Tx);
	});

	console.log(
		"[seed:users] seeded departments/teams/users and verified admin remains",
	);
}
