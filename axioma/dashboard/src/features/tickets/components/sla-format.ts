import type { TicketSlaTarget } from "../api/types";

export function formatSlaTarget(target: TicketSlaTarget) {
	const duration = formatDuration(Math.abs(target.remainingMs));
	if (target.attained !== null)
		return target.attained
			? `Met in ${formatDuration(target.elapsedMs)}`
			: `Missed by ${duration}`;
	if (target.breached) return `Breached by ${duration}`;
	return `${target.running ? "" : "Paused · "}${duration} remaining`;
}

function formatDuration(milliseconds: number) {
	const minutes = Math.ceil(milliseconds / 60_000);
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	return hours
		? `${hours}h${remainder ? ` ${remainder}m` : ""}`
		: `${minutes}m`;
}
