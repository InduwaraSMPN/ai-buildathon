import { relations } from "drizzle-orm";
import {
	boolean,
	foreignKey,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { forms } from "./forms";
import { olas, slas } from "./sla";

export const serviceFamilies = pgTable(
	"service_families",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		description: text("description"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [uniqueIndex("service_families_name_uidx").on(t.name)],
);

export const services = pgTable(
	"services",
	{
		id: text("id").primaryKey(),
		familyId: text("family_id")
			.notNull()
			.references(() => serviceFamilies.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		slaId: text("sla_id"),
		olaId: text("ola_id"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("services_family_name_uidx").on(t.familyId, t.name),
		index("services_sla_idx").on(t.slaId),
		index("services_ola_idx").on(t.olaId),
		foreignKey({
			columns: [t.slaId],
			foreignColumns: [slas.id],
			name: "services_sla_id_fkey",
		}).onDelete("set null"),
		foreignKey({
			columns: [t.olaId],
			foreignColumns: [olas.id],
			name: "services_ola_id_fkey",
		}).onDelete("set null"),
	],
);

export const serviceSubcategories = pgTable(
	"service_subcategories",
	{
		id: text("id").primaryKey(),
		serviceId: text("service_id")
			.notNull()
			.references(() => services.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		approverOverrideId: text("approver_override_id").references(() => user.id, {
			onDelete: "set null",
		}),
		formId: text("form_id"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("service_subcategories_service_name_uidx").on(
			t.serviceId,
			t.name,
		),
		uniqueIndex("service_subcategories_id_service_uidx").on(t.id, t.serviceId),
		index("service_subcategories_approver_idx").on(t.approverOverrideId),
		index("service_subcategories_form_id_idx").on(t.formId),
		foreignKey({
			columns: [t.formId],
			foreignColumns: [forms.id],
			name: "service_subcategories_form_id_fkey",
		}).onDelete("set null"),
	],
);

export const serviceFamiliesRelations = relations(
	serviceFamilies,
	({ many }) => ({
		services: many(services),
	}),
);

export const servicesRelations = relations(services, ({ one, many }) => ({
	family: one(serviceFamilies, {
		fields: [services.familyId],
		references: [serviceFamilies.id],
	}),
	subcategories: many(serviceSubcategories),
}));

export const serviceSubcategoriesRelations = relations(
	serviceSubcategories,
	({ one }) => ({
		service: one(services, {
			fields: [serviceSubcategories.serviceId],
			references: [services.id],
		}),
		approverOverride: one(user, {
			fields: [serviceSubcategories.approverOverrideId],
			references: [user.id],
		}),
	}),
);
