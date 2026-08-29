export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export type RecurrenceRule = Readonly<{
	id: string;
	frequency: RecurrenceFrequency;
	interval: number;
	startsAt: Date;
	until?: Date | null;
}>;

export type DueOccurrence = Readonly<{
	recurringTicketId: string;
	occursAt: Date;
	idempotencyKey: string;
}>;

export function endFromDuration(start: Date, durationMinutes: number): Date {
	assertDate(start, "start");
	if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 0)
		throw new RangeError("durationMinutes must be a non-negative safe integer");
	return new Date(start.getTime() + durationMinutes * 60_000);
}

/** Queue membership is computed; snoozing never changes ticket status. */
export function isVisibleInDefaultQueue(
	snoozedUntil: Date | null | undefined,
	now: Date,
): boolean {
	assertDate(now, "now");
	if (!snoozedUntil) return true;
	assertDate(snoozedUntil, "snoozedUntil");
	return snoozedUntil <= now;
}

/**
 * Returns all due slots not already claimed. Persist each idempotency key with
 * ON CONFLICT DO NOTHING before creating its ticket.
 */
export function dueRecurrenceOccurrences(
	rule: RecurrenceRule,
	now: Date,
	existingKeys: ReadonlySet<string> = new Set(),
	limit = 1_000,
): DueOccurrence[] {
	assertRule(rule);
	assertDate(now, "now");
	if (!Number.isSafeInteger(limit) || limit < 1)
		throw new RangeError("limit must be a positive safe integer");
	if (now < rule.startsAt) return [];

	const last = rule.until && rule.until < now ? rule.until : now;
	const result: DueOccurrence[] = [];
	for (let ordinal = 0; ; ordinal++) {
		const occursAt = occurrenceAt(rule, ordinal);
		if (occursAt > last) break;
		const idempotencyKey = `${rule.id}:${occursAt.toISOString()}`;
		if (!existingKeys.has(idempotencyKey)) {
			if (result.length === limit)
				throw new RangeError("due recurrence occurrence limit exceeded");
			result.push({ recurringTicketId: rule.id, occursAt, idempotencyKey });
		}
	}
	return result;
}

function occurrenceAt(rule: RecurrenceRule, ordinal: number): Date {
	const amount = ordinal * rule.interval;
	const result = new Date(rule.startsAt);
	if (rule.frequency === "daily")
		result.setUTCDate(result.getUTCDate() + amount);
	else if (rule.frequency === "weekly")
		result.setUTCDate(result.getUTCDate() + amount * 7);
	else {
		const day = result.getUTCDate();
		result.setUTCDate(1);
		result.setUTCMonth(result.getUTCMonth() + amount);
		const lastDay = new Date(
			Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
		).getUTCDate();
		result.setUTCDate(Math.min(day, lastDay));
	}
	return result;
}

function assertRule(rule: RecurrenceRule): void {
	if (!rule.id) throw new TypeError("recurrence id is required");
	assertDate(rule.startsAt, "startsAt");
	if (rule.until) {
		assertDate(rule.until, "until");
		if (rule.until < rule.startsAt)
			throw new RangeError("until cannot precede startsAt");
	}
	if (!Number.isSafeInteger(rule.interval) || rule.interval < 1)
		throw new RangeError("interval must be a positive safe integer");
}

function assertDate(value: Date, name: string): void {
	if (Number.isNaN(value.getTime()))
		throw new RangeError(`${name} must be a valid date`);
}
