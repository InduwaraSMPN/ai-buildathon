import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	departments,
	departmentTeams,
	directoryIdentities,
	directorySyncRuns,
	teamMembers,
	teams,
	user,
} from "@/db/schema";
import type {
	CurrentDirectoryPerson,
	DirectoryPerson,
	DirectorySyncPlan,
	DirectorySyncStore,
} from "./sync";

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class DatabaseDirectorySyncStore implements DirectorySyncStore {
	constructor(
		private readonly providerId: string,
		private readonly database: Database = db,
	) {}

	async current(): Promise<CurrentDirectoryPerson[]> {
		const rows = await this.database
			.select({ identity: directoryIdentities, person: user })
			.from(directoryIdentities)
			.innerJoin(user, eq(directoryIdentities.userId, user.id))
			.where(eq(directoryIdentities.providerId, this.providerId));
		const externalIdByUser = new Map(
			rows.map(({ identity }) => [identity.userId, identity.externalId]),
		);
		return rows.map(({ identity, person }) => ({
			userId: person.id,
			externalId: identity.externalId,
			email: person.email,
			name: person.name,
			jobTitle: person.jobTitle,
			department: identity.department,
			managerExternalId: person.managerId
				? (externalIdByUser.get(person.managerId) ?? null)
				: null,
			leaver: identity.leaver,
		}));
	}

	async lastSuccessfulCount(): Promise<number> {
		const [run] = await this.database
			.select({ foundCount: directorySyncRuns.foundCount })
			.from(directorySyncRuns)
			.where(
				and(
					eq(directorySyncRuns.providerId, this.providerId),
					eq(directorySyncRuns.mode, "apply"),
					eq(directorySyncRuns.status, "completed"),
				),
			)
			.orderBy(desc(directorySyncRuns.createdAt))
			.limit(1);
		return run?.foundCount ?? 0;
	}

	async apply(plan: DirectorySyncPlan): Promise<void> {
		await this.database.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${this.providerId}))`,
			);
			const now = new Date();
			for (const change of plan.changes) {
				if (change.kind === "mark_leaver") {
					await tx
						.update(directoryIdentities)
						.set({ leaver: true, updatedAt: now })
						.where(
							and(
								eq(directoryIdentities.providerId, this.providerId),
								eq(directoryIdentities.userId, change.userId),
							),
						);
					continue;
				}
				const userId =
					change.kind === "create" ? crypto.randomUUID() : change.userId;
				if (change.kind === "create")
					await tx.insert(user).values({
						id: userId,
						email: change.person.email,
						name: change.person.name,
						jobTitle: change.person.jobTitle,
						kind: "reporter",
					});
				else
					await tx
						.update(user)
						.set({
							email: change.person.email,
							name: change.person.name,
							jobTitle: change.person.jobTitle,
							updatedAt: now,
						})
						.where(eq(user.id, userId));
				await tx
					.insert(directoryIdentities)
					.values({
						id: crypto.randomUUID(),
						providerId: this.providerId,
						userId,
						externalId: change.person.externalId,
						department: change.person.department,
						lastSeenAt: now,
					})
					.onConflictDoUpdate({
						target: [
							directoryIdentities.providerId,
							directoryIdentities.userId,
						],
						set: {
							externalId: change.person.externalId,
							department: change.person.department,
							leaver: false,
							lastSeenAt: now,
							updatedAt: now,
						},
					});
				await this.applyDepartment(tx, userId, change.person);
			}
			await this.applyManagers(tx, plan);
			await tx.insert(directorySyncRuns).values({
				id: crypto.randomUUID(),
				providerId: this.providerId,
				mode: "apply",
				status: "completed",
				...counts(plan),
				summary: { changes: plan.changes.length },
			});
		});
	}

	private async applyDepartment(
		tx: Transaction,
		userId: string,
		person: DirectoryPerson,
	) {
		if (!person.department) return;
		let [department] = await tx
			.select({ id: departments.id })
			.from(departments)
			.where(eq(departments.name, person.department))
			.limit(1);
		if (!department)
			[department] = await tx
				.insert(departments)
				.values({ id: crypto.randomUUID(), name: person.department })
				.onConflictDoNothing()
				.returning({ id: departments.id });
		if (!department)
			[department] = await tx
				.select({ id: departments.id })
				.from(departments)
				.where(eq(departments.name, person.department))
				.limit(1);
		if (!department) throw new Error("Failed to resolve directory department");
		let [team] = await tx
			.select({ id: teams.id })
			.from(teams)
			.innerJoin(departmentTeams, eq(departmentTeams.teamId, teams.id))
			.where(eq(departmentTeams.departmentId, department.id))
			.limit(1);
		if (!team) {
			const id = crypto.randomUUID();
			await tx
				.insert(teams)
				.values({ id, name: person.department })
				.onConflictDoNothing();
			[team] = await tx
				.select({ id: teams.id })
				.from(teams)
				.where(eq(teams.name, person.department))
				.limit(1);
			if (team)
				await tx
					.insert(departmentTeams)
					.values({ departmentId: department.id, teamId: team.id })
					.onConflictDoNothing();
		}
		if (team)
			await tx
				.insert(teamMembers)
				.values({ teamId: team.id, userId })
				.onConflictDoNothing();
	}

	private async applyManagers(tx: Transaction, plan: DirectorySyncPlan) {
		const people = plan.changes.flatMap((change) =>
			change.kind === "mark_leaver" ? [] : [change.person],
		);
		const externalIds = people.map((person) => person.externalId);
		if (!externalIds.length) return;
		const identities = await tx
			.select({
				externalId: directoryIdentities.externalId,
				userId: directoryIdentities.userId,
			})
			.from(directoryIdentities)
			.where(
				and(
					eq(directoryIdentities.providerId, this.providerId),
					inArray(directoryIdentities.externalId, externalIds),
				),
			);
		const userByExternalId = new Map(
			identities.map((row) => [row.externalId, row.userId]),
		);
		for (const person of people) {
			const userId = userByExternalId.get(person.externalId);
			if (userId)
				await tx
					.update(user)
					.set({
						managerId: person.managerExternalId
							? (userByExternalId.get(person.managerExternalId) ?? null)
							: null,
					})
					.where(eq(user.id, userId));
		}
	}
}

const counts = (plan: DirectorySyncPlan) => ({
	previousCount: plan.previousCount,
	foundCount: plan.foundCount,
	createdCount: plan.createdCount,
	updatedCount: plan.updatedCount,
	leaverCount: plan.leaverCount,
});
