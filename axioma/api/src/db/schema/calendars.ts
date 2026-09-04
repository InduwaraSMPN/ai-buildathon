import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	date,
	index,
	integer,
	pgTable,
	text,
	time,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const calendars = pgTable(
	"calendars",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		timezone: text("timezone").notNull(),
		isDefault: boolean("is_default").notNull().default(false),
	},
	(t) => [
		index("calendars_default_idx").on(t.isDefault),
		uniqueIndex("calendars_default_uidx")
			.on(t.isDefault)
			.where(sql`${t.isDefault} = true`),
	],
);

export const calendarHours = pgTable(
	"calendar_hours",
	{
		id: text("id").primaryKey(),
		calendarId: text("calendar_id")
			.notNull()
			.references(() => calendars.id, { onDelete: "cascade" }),
		weekday: integer("weekday").notNull(),
		startTime: time("start_time").notNull(),
		endTime: time("end_time").notNull(),
	},
	(t) => [
		index("calendar_hours_calendar_idx").on(t.calendarId, t.weekday),
		check("calendar_hours_weekday_check", sql`${t.weekday} between 0 and 6`),
		check("calendar_hours_range_check", sql`${t.startTime} < ${t.endTime}`),
	],
);

export const calendarHolidays = pgTable(
	"calendar_holidays",
	{
		id: text("id").primaryKey(),
		calendarId: text("calendar_id")
			.notNull()
			.references(() => calendars.id, { onDelete: "cascade" }),
		date: date("date", { mode: "string" }).notNull(),
		name: text("name").notNull(),
	},
	(t) => [
		uniqueIndex("calendar_holidays_calendar_date_uidx").on(
			t.calendarId,
			t.date,
		),
	],
);
