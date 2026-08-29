export type ContractCoverage = Readonly<{
	contractId: string;
	serviceId: string;
	slaId: string;
	active: boolean;
	startsOn: string;
	endsOn?: string | null;
	timezone: string;
	weekday: number;
	startMinute: number;
	endMinute: number;
	priority: number;
}>;

/** Resolve the most specific active coverage deterministically. */
export function resolveContractSla(
	serviceId: string,
	at: Date,
	coverage: readonly ContractCoverage[],
): string | null {
	if (!serviceId) throw new TypeError("serviceId is required");
	if (Number.isNaN(at.getTime()))
		throw new RangeError("at must be a valid date");

	const matches = coverage.filter((candidate) => {
		validateCoverage(candidate);
		if (!candidate.active || candidate.serviceId !== serviceId) return false;
		const local = localDateTime(at, candidate.timezone);
		return (
			local.date >= candidate.startsOn &&
			(!candidate.endsOn || local.date <= candidate.endsOn) &&
			local.weekday === candidate.weekday &&
			local.minute >= candidate.startMinute &&
			local.minute < candidate.endMinute
		);
	});

	matches.sort(
		(a, b) =>
			b.priority - a.priority ||
			b.startsOn.localeCompare(a.startsOn) ||
			a.contractId.localeCompare(b.contractId),
	);
	return matches[0]?.slaId ?? null;
}

function localDateTime(at: Date, timezone: string) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
		weekday: "short",
	}).formatToParts(at);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((value) => value.type === type)?.value ?? "";
	const weekdays: Record<string, number> = {
		Sun: 0,
		Mon: 1,
		Tue: 2,
		Wed: 3,
		Thu: 4,
		Fri: 5,
		Sat: 6,
	};
	const weekday = weekdays[part("weekday")];
	if (weekday === undefined)
		throw new RangeError(`Unsupported weekday in ${timezone}`);
	return {
		date: `${part("year")}-${part("month")}-${part("day")}`,
		weekday,
		minute: Number(part("hour")) * 60 + Number(part("minute")),
	};
}

function validateCoverage(value: ContractCoverage): void {
	if (
		value.weekday < 0 ||
		value.weekday > 6 ||
		value.startMinute < 0 ||
		value.startMinute >= value.endMinute ||
		value.endMinute > 1_440
	)
		throw new RangeError("Invalid contract coverage window");
	if (value.endsOn && value.endsOn < value.startsOn)
		throw new RangeError("Contract end cannot precede start");
}
