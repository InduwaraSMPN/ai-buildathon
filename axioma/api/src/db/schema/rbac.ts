import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { CAPABILITIES } from "@/shared";
import { user } from "./auth";
import { teams } from "./org";

const capabilityList = sql.raw(
	CAPABILITIES.map((key) => `'${key}'`).join(", "),
);

export const roles = pgTable("roles", {
	id: text("id").primaryKey(),
	name: text("name").notNull().unique(),
	description: text("description"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const roleCapabilities = pgTable(
	"role_capabilities",
	{
		roleId: text("role_id")
			.notNull()
			.references(() => roles.id, { onDelete: "cascade" }),
		capability: text("capability", { enum: CAPABILITIES }).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.roleId, t.capability] }),
		check(
			"role_capabilities_key_check",
			sql`${t.capability} in (${capabilityList})`,
		),
	],
);

export const userRoles = pgTable(
	"user_roles",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		roleId: text("role_id")
			.notNull()
			.references(() => roles.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.roleId] }),
		index("user_roles_role_idx").on(t.roleId),
	],
);

export const teamRoles = pgTable(
	"team_roles",
	{
		teamId: text("team_id")
			.notNull()
			.references(() => teams.id, { onDelete: "cascade" }),
		roleId: text("role_id")
			.notNull()
			.references(() => roles.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.teamId, t.roleId] }),
		index("team_roles_role_idx").on(t.roleId),
	],
);

export const roleGrants = pgTable(
	"role_grants",
	{
		id: text("id").primaryKey(),
		action: text("action", { enum: ["grant", "revoke", "set_kind"] }).notNull(),
		roleId: text("role_id").references(() => roles.id, {
			onDelete: "restrict",
		}),
		roleName: text("role_name"),
		targetType: text("target_type", {
			enum: ["user", "team", "capability", "user_kind"],
		}).notNull(),
		targetId: text("target_id").notNull(),
		actorId: text("actor_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		check(
			"role_grants_action_check",
			sql`${t.action} in ('grant', 'revoke', 'set_kind')`,
		),
		check(
			"role_grants_target_type_check",
			sql`${t.targetType} in ('user', 'team', 'capability', 'user_kind')`,
		),
		check(
			"role_grants_role_check",
			sql`(${t.targetType} = 'user_kind') = (${t.roleId} is null and ${t.roleName} is null)`,
		),
		check(
			"role_grants_capability_check",
			sql`${t.targetType} <> 'capability' or ${t.targetId} in (${capabilityList})`,
		),
		index("role_grants_target_idx").on(t.targetType, t.targetId, t.createdAt),
		index("role_grants_role_idx").on(t.roleId, t.createdAt),
		index("role_grants_actor_id_idx").on(t.actorId),
	],
);

export const rolesRelations = relations(roles, ({ many }) => ({
	capabilities: many(roleCapabilities),
	users: many(userRoles),
	teams: many(teamRoles),
	grants: many(roleGrants),
}));

export const roleCapabilitiesRelations = relations(
	roleCapabilities,
	({ one }) => ({
		role: one(roles, {
			fields: [roleCapabilities.roleId],
			references: [roles.id],
		}),
	}),
);

export const userRolesRelations = relations(userRoles, ({ one }) => ({
	user: one(user, { fields: [userRoles.userId], references: [user.id] }),
	role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const teamRolesRelations = relations(teamRoles, ({ one }) => ({
	team: one(teams, { fields: [teamRoles.teamId], references: [teams.id] }),
	role: one(roles, { fields: [teamRoles.roleId], references: [roles.id] }),
}));

export const roleGrantsRelations = relations(roleGrants, ({ one }) => ({
	role: one(roles, { fields: [roleGrants.roleId], references: [roles.id] }),
}));
