import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { authProviders, user } from "@/db/schema";
import { teamMembers, teams } from "@/db/schema/org";
import {
	roleCapabilities,
	roleGrants,
	roles,
	teamRoles,
	userRoles,
} from "@/db/schema/rbac";
import { fetchDirectoryPeople } from "../directory/http-source";
import { DatabaseDirectorySyncStore } from "../directory/store";
import { syncDirectory } from "../directory/sync";
import {
	capabilityProcedure,
	privateDataProcedure,
	publicProcedure,
} from "../orpc";

export const identityRouter = {
	privateData: privateDataProcedure.privateData.handler(({ context }) => ({
		message: "This is private",
		user: context.session
			? {
					id: context.session.user.id,
					name: context.session.user.name,
					email: context.session.user.email,
					kind:
						context.session.user.kind === "staff"
							? ("staff" as const)
							: ("reporter" as const),
				}
			: null,
		capabilities: [...context.capabilities],
	})),
	listRoles: capabilityProcedure("admin.roles").listRoles.handler(async () => {
		const rows = await db.select().from(roles).orderBy(asc(roles.name));
		const grants = await db.select().from(roleCapabilities);
		return rows.map((role) => ({
			...role,
			capabilities: grants
				.filter((item) => item.roleId === role.id)
				.map((item) => item.capability),
		}));
	}),
	getRole: capabilityProcedure("admin.roles").getRole.handler(
		async ({ input }) => {
			const role = (
				await db.select().from(roles).where(eq(roles.id, input.id)).limit(1)
			)[0];
			if (!role) return null;
			const capabilities = await db
				.select({ capability: roleCapabilities.capability })
				.from(roleCapabilities)
				.where(eq(roleCapabilities.roleId, role.id));
			return {
				...role,
				capabilities: capabilities.map((item) => item.capability),
			};
		},
	),
	updateRoleCapabilities: capabilityProcedure(
		"admin.roles",
	).updateRoleCapabilities.handler(async ({ context, input }) => {
		const role = (
			await db.select().from(roles).where(eq(roles.id, input.roleId)).limit(1)
		)[0];
		if (!role) throw new ORPCError("NOT_FOUND");
		await db.transaction(async (tx) => {
			const existing = await tx
				.select({ capability: roleCapabilities.capability })
				.from(roleCapabilities)
				.where(eq(roleCapabilities.roleId, role.id));
			const before = new Set(existing.map((item) => item.capability));
			await tx
				.delete(roleCapabilities)
				.where(eq(roleCapabilities.roleId, role.id));
			if (input.capabilities.length)
				await tx.insert(roleCapabilities).values(
					input.capabilities.map((capability) => ({
						roleId: role.id,
						capability,
					})),
				);
			const changes = [...new Set([...before, ...input.capabilities])].filter(
				(capability) =>
					before.has(capability) !== input.capabilities.includes(capability),
			);
			if (changes.length)
				await tx.insert(roleGrants).values(
					changes.map((capability) => ({
						id: crypto.randomUUID(),
						action: input.capabilities.includes(capability)
							? ("grant" as const)
							: ("revoke" as const),
						roleId: role.id,
						roleName: role.name,
						targetType: "capability" as const,
						targetId: capability,
						actorId: context.userId,
					})),
				);
		});
		return { ...role, capabilities: input.capabilities };
	}),
	assignRole: capabilityProcedure("admin.roles").assignRole.handler(
		async ({ context, input }) => {
			const role = (
				await db.select().from(roles).where(eq(roles.id, input.roleId)).limit(1)
			)[0];
			if (!role) throw new ORPCError("NOT_FOUND");
			await db.transaction(async (tx) => {
				const target =
					input.targetType === "user"
						? await tx
								.select({ id: user.id })
								.from(user)
								.where(eq(user.id, input.targetId))
								.limit(1)
						: await tx
								.select({ id: teams.id })
								.from(teams)
								.where(eq(teams.id, input.targetId))
								.limit(1);
				if (!target[0]) throw new ORPCError("NOT_FOUND");
				const changed =
					input.targetType === "user"
						? input.assigned
							? await tx
									.insert(userRoles)
									.values({ userId: input.targetId, roleId: role.id })
									.onConflictDoNothing()
									.returning({ id: userRoles.userId })
							: await tx
									.delete(userRoles)
									.where(
										and(
											eq(userRoles.userId, input.targetId),
											eq(userRoles.roleId, role.id),
										),
									)
									.returning({ id: userRoles.userId })
						: input.assigned
							? await tx
									.insert(teamRoles)
									.values({ teamId: input.targetId, roleId: role.id })
									.onConflictDoNothing()
									.returning({ id: teamRoles.teamId })
							: await tx
									.delete(teamRoles)
									.where(
										and(
											eq(teamRoles.teamId, input.targetId),
											eq(teamRoles.roleId, role.id),
										),
									)
									.returning({ id: teamRoles.teamId });
				if (changed[0])
					await tx.insert(roleGrants).values({
						id: crypto.randomUUID(),
						action: input.assigned ? "grant" : "revoke",
						roleId: role.id,
						roleName: role.name,
						targetType: input.targetType,
						targetId: input.targetId,
						actorId: context.userId,
					});
			});
			return { assigned: input.assigned };
		},
	),
	listTeams: capabilityProcedure("admin.roles").listTeams.handler(async () => {
		const [rows, members, grants] = await Promise.all([
			db.select().from(teams).orderBy(asc(teams.name)),
			db.select().from(teamMembers),
			db.select().from(teamRoles),
		]);
		return rows.map((team) => ({
			...team,
			memberIds: members
				.filter((item) => item.teamId === team.id)
				.map((item) => item.userId),
			roleIds: grants
				.filter((item) => item.teamId === team.id)
				.map((item) => item.roleId),
		}));
	}),
	updateTeam: capabilityProcedure("admin.roles").updateTeam.handler(
		async ({ context, input }) => {
			const team = await db.transaction(async (tx) => {
				const updated = (
					await tx
						.update(teams)
						.set({ name: input.name, updatedAt: new Date() })
						.where(eq(teams.id, input.id))
						.returning()
				)[0];
				if (!updated) throw new ORPCError("NOT_FOUND");
				const oldRoles = await tx
					.select({ roleId: teamRoles.roleId })
					.from(teamRoles)
					.where(eq(teamRoles.teamId, updated.id));
				await tx.delete(teamMembers).where(eq(teamMembers.teamId, updated.id));
				await tx.delete(teamRoles).where(eq(teamRoles.teamId, updated.id));
				if (input.memberIds.length)
					await tx
						.insert(teamMembers)
						.values(
							input.memberIds.map((userId) => ({ teamId: updated.id, userId })),
						);
				if (input.roleIds.length)
					await tx
						.insert(teamRoles)
						.values(
							input.roleIds.map((roleId) => ({ teamId: updated.id, roleId })),
						);
				const changed = [
					...new Set([
						...oldRoles.map((item) => item.roleId),
						...input.roleIds,
					]),
				].filter(
					(roleId) =>
						oldRoles.some((item) => item.roleId === roleId) !==
						input.roleIds.includes(roleId),
				);
				if (changed.length) {
					const names = await tx
						.select({ id: roles.id, name: roles.name })
						.from(roles)
						.where(inArray(roles.id, changed));
					await tx.insert(roleGrants).values(
						changed.map((roleId) => ({
							id: crypto.randomUUID(),
							action: input.roleIds.includes(roleId)
								? ("grant" as const)
								: ("revoke" as const),
							roleId,
							roleName:
								names.find((item) => item.id === roleId)?.name ?? roleId,
							targetType: "team" as const,
							targetId: updated.id,
							actorId: context.userId,
						})),
					);
				}
				return updated;
			});
			return { ...team, memberIds: input.memberIds, roleIds: input.roleIds };
		},
	),
	listAuthProviders: publicProcedure.listAuthProviders.handler(() =>
		db
			.select({
				providerId: authProviders.providerId,
				name: authProviders.name,
			})
			.from(authProviders)
			.where(eq(authProviders.enabled, true))
			.orderBy(authProviders.name),
	),
	previewDirectorySync: capabilityProcedure(
		"admin.settings",
	).previewDirectorySync.handler(async ({ input }) =>
		syncDirectory(
			new DatabaseDirectorySyncStore(input.providerId),
			await fetchDirectoryPeople(input.providerId),
			"preview",
		),
	),
	applyDirectorySync: capabilityProcedure(
		"admin.settings",
	).applyDirectorySync.handler(async ({ input }) =>
		syncDirectory(
			new DatabaseDirectorySyncStore(input.providerId),
			await fetchDirectoryPeople(input.providerId),
			"apply",
		),
	),
};
