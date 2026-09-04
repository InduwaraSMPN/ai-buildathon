/**
 * `datetime-local` controls carry no timezone: the browser reads and writes the
 * operator's wall clock. Rendering a UTC string into one therefore shows the
 * wrong time and reading it back shifts the instant by the UTC offset — again on
 * every subsequent save. Both directions go through the local getters here so a
 * value survives a round trip unchanged.
 */

const pad = (value: number) => String(value).padStart(2, "0");

/** Formats an instant as the `YYYY-MM-DDTHH:mm` a `datetime-local` expects. */
export function toDateTimeLocal(value: Date | string | number): string {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
		date.getDate(),
	)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The bare local shape a `datetime-local` submits, with optional seconds. */
const localShape = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Reads a `datetime-local` value back as the instant it displayed. A value that
 * already carries a zone — a stored ISO string, say — is parsed as written.
 */
export function fromDateTimeLocal(value: string): Date {
	const parts = localShape.exec(value);
	if (!parts) return new Date(value);
	return new Date(
		Number(parts[1]),
		Number(parts[2]) - 1,
		Number(parts[3]),
		Number(parts[4]),
		Number(parts[5]),
		Number(parts[6] || 0),
	);
}
