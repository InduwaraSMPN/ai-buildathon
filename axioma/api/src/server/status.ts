const DAY_MS = 86_400_000;

export type StatusIncident = {
	startedAt: Date;
	resolvedAt: Date | null;
	impactLevel: string;
	plannedMaintenance?: boolean;
};

export type ImpactConfiguration = Readonly<Record<string, boolean>>;
export type PlannedChangeWindow = { startsAt: Date; endsAt: Date };
export type AvailabilityDay = { date: string; availability: number };

const clippedDowntime = (
	incidents: readonly StatusIncident[],
	impacts: ImpactConfiguration,
	start: number,
	end: number,
	excludePlannedMaintenance: boolean,
	plannedChanges: readonly PlannedChangeWindow[],
) => {
	const intervals = incidents
		.filter(
			(i) =>
				impacts[i.impactLevel] === true &&
				(!excludePlannedMaintenance || !i.plannedMaintenance),
		)
		.map(
			(i) =>
				[
					Math.max(start, i.startedAt.getTime()),
					Math.min(end, i.resolvedAt?.getTime() ?? end),
				] as const,
		)
		.flatMap(([from, to]) =>
			excludePlannedMaintenance
				? subtractWindows([from, to], plannedChanges)
				: [[from, to] as const],
		)
		.filter(([from, to]) => to > from)
		.sort((a, b) => a[0] - b[0]);

	let total = 0;
	let cursorStart = 0;
	let cursorEnd = 0;
	for (const [from, to] of intervals) {
		if (to <= cursorEnd) continue;
		if (from > cursorEnd) {
			total += cursorEnd - cursorStart;
			cursorStart = from;
		}
		cursorEnd = to;
	}
	return total + cursorEnd - cursorStart;
};

function subtractWindows(
	interval: readonly [number, number],
	windows: readonly PlannedChangeWindow[],
): (readonly [number, number])[] {
	return windows.reduce<(readonly [number, number])[]>(
		(parts, window) =>
			parts.flatMap(([from, to]) => {
				const start = window.startsAt.getTime();
				const end = window.endsAt.getTime();
				if (end <= from || start >= to) return [[from, to] as const];
				const before: readonly [number, number] = [from, Math.max(from, start)];
				const after: readonly [number, number] = [Math.min(to, end), to];
				return [before, after].filter(([a, b]) => b > a);
			}),
		[interval],
	);
}

export function availabilityBetween(
	incidents: readonly StatusIncident[],
	impacts: ImpactConfiguration,
	start: Date,
	end: Date,
	excludePlannedMaintenance = true,
	plannedChanges: readonly PlannedChangeWindow[] = [],
) {
	const from = start.getTime();
	const to = end.getTime();
	if (to <= from)
		throw new RangeError("Availability window must have a positive duration");
	return (
		1 -
		clippedDowntime(
			incidents,
			impacts,
			from,
			to,
			excludePlannedMaintenance,
			plannedChanges,
		) /
			(to - from)
	);
}

export function dailyAvailability(
	incidents: readonly StatusIncident[],
	impacts: ImpactConfiguration,
	end: Date,
	days = 90,
	excludePlannedMaintenance = true,
	plannedChanges: readonly PlannedChangeWindow[] = [],
): AvailabilityDay[] {
	if (!Number.isInteger(days) || days < 1)
		throw new RangeError("days must be a positive integer");
	const finalDay = Date.UTC(
		end.getUTCFullYear(),
		end.getUTCMonth(),
		end.getUTCDate(),
	);
	return Array.from({ length: days }, (_, index) => {
		const start = finalDay - (days - index - 1) * DAY_MS;
		return {
			date: new Date(start).toISOString().slice(0, 10),
			availability: availabilityBetween(
				incidents,
				impacts,
				new Date(start),
				new Date(start + DAY_MS),
				excludePlannedMaintenance,
				plannedChanges,
			),
		};
	});
}

export function uptimeWindows(
	incidents: readonly StatusIncident[],
	impacts: ImpactConfiguration,
	end: Date,
	excludePlannedMaintenance = true,
	plannedChanges: readonly PlannedChangeWindow[] = [],
) {
	return Object.fromEntries(
		[7, 30, 90].map((days) => [
			days,
			availabilityBetween(
				incidents,
				impacts,
				new Date(end.getTime() - days * DAY_MS),
				end,
				excludePlannedMaintenance,
				plannedChanges,
			),
		]),
	) as Record<7 | 30 | 90, number>;
}
