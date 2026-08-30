import { eq } from "drizzle-orm";

export type WorkingHours = {
	weekday: number;
	startTime: string;
	endTime: string;
};

export type WorkingCalendar = {
	timezone: string;
	hours: readonly WorkingHours[];
	holidays: readonly string[];
};

export type CalendarLoader = (calendarId: string) => Promise<WorkingCalendar>;

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
const MAX_FORMATTERS = 64;

function formatter(timezone: string) {
	let value = partsFormatters.get(timezone);
	if (!value) {
		value = new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			calendar: "gregory",
			numberingSystem: "latn",
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
		if (partsFormatters.size >= MAX_FORMATTERS)
			partsFormatters.delete(partsFormatters.keys().next().value ?? "");
		partsFormatters.set(timezone, value);
	}
	return value;
}

function zonedParts(date: Date, timezone: string) {
	const result: Record<string, number> = {};
	for (const part of formatter(timezone).formatToParts(date))
		if (part.type !== "literal") result[part.type] = Number(part.value);
	return {
		year: result.year ?? 0,
		month: result.month ?? 0,
		day: result.day ?? 0,
		hour: result.hour ?? 0,
		minute: result.minute ?? 0,
		second: result.second ?? 0,
	};
}

function dateKey(date: Date, timezone: string) {
	const { year, month, day } = zonedParts(date, timezone);
	return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function nextDate(date: string) {
	const [year, month, day] = date.split("-").map(Number) as [
		number,
		number,
		number,
	];
	return new Date(Date.UTC(year, month - 1, day + 1))
		.toISOString()
		.slice(0, 10);
}

function weekday(date: string) {
	const [year, month, day] = date.split("-").map(Number) as [
		number,
		number,
		number,
	];
	return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function timeParts(time: string) {
	const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(time);
	if (!match) throw new Error(`Invalid calendar time: ${time}`);
	return {
		hour: Number(match[1]),
		minute: Number(match[2]),
		second: Number(match[3] ?? 0),
		millisecond: Number((match[4] ?? "").padEnd(3, "0")),
	};
}

function zonedDate(date: string, time: string, timezone: string) {
	const [year, month, day] = date.split("-").map(Number) as [
		number,
		number,
		number,
	];
	const desired = { year, month, day, ...timeParts(time) };
	const localMs = Date.UTC(
		desired.year,
		desired.month - 1,
		desired.day,
		desired.hour,
		desired.minute,
		desired.second,
		desired.millisecond,
	);
	let instant = localMs;
	for (let attempt = 0; attempt < 4; attempt++) {
		const actual = zonedParts(new Date(instant), timezone);
		const difference =
			localMs -
			Date.UTC(
				actual.year,
				actual.month - 1,
				actual.day,
				actual.hour,
				actual.minute,
				actual.second,
				desired.millisecond,
			);
		if (difference === 0) break;
		instant += difference;
	}
	return new Date(instant);
}

function validate(calendar: WorkingCalendar) {
	formatter(calendar.timezone);
	if (calendar.hours.length === 0)
		throw new Error("Calendar has no working hours");
	for (const hour of calendar.hours) {
		if (hour.weekday < 0 || hour.weekday > 6)
			throw new Error(`Invalid calendar weekday: ${hour.weekday}`);
		const start = timeParts(hour.startTime);
		const end = timeParts(hour.endTime);
		if (start.hour > 23 || end.hour > 23)
			throw new Error("Invalid calendar hour");
		const milliseconds = (value: typeof start) =>
			((value.hour * 60 + value.minute) * 60 + value.second) * 1_000 +
			value.millisecond;
		if (milliseconds(start) >= milliseconds(end))
			throw new Error("Calendar working hours must end after they start");
	}
}

function intervals(date: string, calendar: WorkingCalendar) {
	if (calendar.holidays.includes(date)) return [];
	return calendar.hours
		.filter((hour) => hour.weekday === weekday(date))
		.map((hour) => ({
			start: zonedDate(date, hour.startTime, calendar.timezone),
			end: zonedDate(date, hour.endTime, calendar.timezone),
		}))
		.sort((a, b) => a.start.getTime() - b.start.getTime());
}

async function loadCalendar(calendarId: string): Promise<WorkingCalendar> {
	const [{ db }, schema] = await Promise.all([
		import("@/db"),
		import("@/db/schema"),
	]);
	const [calendar] = await db
		.select()
		.from(schema.calendars)
		.where(eq(schema.calendars.id, calendarId))
		.limit(1);
	if (!calendar) throw new Error(`Calendar not found: ${calendarId}`);
	const [hours, holidays] = await Promise.all([
		db
			.select()
			.from(schema.calendarHours)
			.where(eq(schema.calendarHours.calendarId, calendarId)),
		db
			.select()
			.from(schema.calendarHolidays)
			.where(eq(schema.calendarHolidays.calendarId, calendarId)),
	]);
	return {
		timezone: calendar.timezone,
		hours,
		holidays: holidays.map((holiday) => holiday.date),
	};
}

export async function elapsedWorkingMs(
	from: Date,
	to: Date,
	calendarId: string,
	load: CalendarLoader = loadCalendar,
) {
	if (to <= from) return 0;
	const calendar = await load(calendarId);
	validate(calendar);
	let total = 0;
	let days = 0;
	for (
		let date = dateKey(from, calendar.timezone),
			last = dateKey(to, calendar.timezone);
		date <= last;
		date = nextDate(date)
	) {
		if (++days > 366) throw new RangeError("Calendar range exceeds 366 days");
		for (const interval of intervals(date, calendar))
			total += Math.max(
				0,
				Math.min(to.getTime(), interval.end.getTime()) -
					Math.max(from.getTime(), interval.start.getTime()),
			);
	}
	return total;
}

export async function addWorkingMs(
	from: Date,
	ms: number,
	calendarId: string,
	load: CalendarLoader = loadCalendar,
) {
	if (!Number.isFinite(ms) || ms < 0)
		throw new Error("Working duration must be non-negative");
	if (ms === 0) return new Date(from);
	const calendar = await load(calendarId);
	validate(calendar);
	let remaining = ms;
	let cursor = new Date(from);
	let days = 0;
	for (let date = dateKey(from, calendar.timezone); ; date = nextDate(date)) {
		if (++days > 366)
			throw new RangeError("Calendar duration exceeds 366 days");
		for (const interval of intervals(date, calendar)) {
			const start = new Date(
				Math.max(cursor.getTime(), interval.start.getTime()),
			);
			if (start >= interval.end) continue;
			const available = interval.end.getTime() - start.getTime();
			if (remaining <= available) return new Date(start.getTime() + remaining);
			remaining -= available;
		}
		cursor = zonedDate(nextDate(date), "00:00:00", calendar.timezone);
	}
}
