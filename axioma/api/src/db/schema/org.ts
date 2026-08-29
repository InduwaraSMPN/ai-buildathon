import { relations } from "drizzle-orm";
import {
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const departments = pgTable("departments", {
	id: text("id").primaryKey(),
	name: text("name").notNull().unique(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const teams = pgTable("teams", {
	id: text("id").primaryKey(),
	name: text("name").notNull().unique(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const teamMembers = pgTable(
	"team_members",
	{
		teamId: text("team_id")
			.notNull()
			.references(() => teams.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.teamId, t.userId] }),
		index("team_members_user_idx").on(t.userId),
	],
);

export const departmentTeams = pgTable(
	"department_teams",
	{
		departmentId: text("department_id")
			.notNull()
			.references(() => departments.id, { onDelete: "cascade" }),
		teamId: text("team_id")
			.notNull()
			.references(() => teams.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.departmentId, t.teamId] }),
		uniqueIndex("department_teams_team_uidx").on(t.teamId),
	],
);

export const departmentsRelations = relations(departments, ({ many }) => ({
	teams: many(departmentTeams),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
	members: many(teamMembers),
	departments: many(departmentTeams),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
	team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
	user: one(user, { fields: [teamMembers.userId], references: [user.id] }),
}));

export const departmentTeamsRelations = relations(
	departmentTeams,
	({ one }) => ({
		department: one(departments, {
			fields: [departmentTeams.departmentId],
			references: [departments.id],
		}),
		team: one(teams, {
			fields: [departmentTeams.teamId],
			references: [teams.id],
		}),
	}),
);
