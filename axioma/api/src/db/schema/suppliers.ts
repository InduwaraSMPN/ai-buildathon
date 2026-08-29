import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	date,
	index,
	integer,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { slas } from "./sla";

export const suppliers = pgTable("suppliers", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	contactName: text("contact_name"),
	contactEmail: text("contact_email"),
	active: boolean("active").notNull().default(true),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const contracts = pgTable(
	"contracts",
	{
		id: text("id").primaryKey(),
		supplierId: text("supplier_id")
			.notNull()
			.references(() => suppliers.id, { onDelete: "restrict" }),
		serviceId: text("service_id").notNull(),
		name: text("name").notNull(),
		reference: text("reference"),
		startsOn: date("starts_on", { mode: "string" }).notNull(),
		endsOn: date("ends_on", { mode: "string" }),
		active: boolean("active").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		index("contracts_service_dates_idx").on(t.serviceId, t.startsOn, t.endsOn),
		index("contracts_supplier_idx").on(t.supplierId),
		check(
			"contracts_date_range_check",
			sql`${t.endsOn} IS NULL OR ${t.endsOn} >= ${t.startsOn}`,
		),
	],
);

export const contractCoverageWindows = pgTable(
	"contract_coverage_windows",
	{
		id: text("id").primaryKey(),
		contractId: text("contract_id")
			.notNull()
			.references(() => contracts.id, { onDelete: "cascade" }),
		slaId: text("sla_id")
			.notNull()
			.references(() => slas.id, { onDelete: "restrict" }),
		timezone: text("timezone").notNull(),
		weekday: integer("weekday").notNull(),
		startMinute: integer("start_minute").notNull(),
		endMinute: integer("end_minute").notNull(),
		priority: integer("priority").notNull().default(0),
	},
	(t) => [
		index("contract_coverage_windows_contract_idx").on(t.contractId, t.weekday),
		index("contract_coverage_windows_sla_id_idx").on(t.slaId),
		check(
			"contract_coverage_windows_weekday_check",
			sql`${t.weekday} between 0 and 6`,
		),
		check(
			"contract_coverage_windows_minutes_check",
			sql`${t.startMinute} >= 0 AND ${t.startMinute} < ${t.endMinute} AND ${t.endMinute} <= 1440`,
		),
	],
);

// contract_terms and payment_schedules had no application path; 0037 drops them until contract detail needs them.
