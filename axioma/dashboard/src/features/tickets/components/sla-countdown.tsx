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

export function SlaCountdown({ targets }: { targets: TicketSlaTarget[] }) {
	if (!targets.length) return null;
	return (
		<section className="rounded-xl border bg-card p-4 shadow-sm">
			<h2 className="mb-3 font-semibold text-xs uppercase tracking-wider">
				Service levels
			</h2>
			<dl className="space-y-2 text-xs">
				{targets.map((target) => (
					<div
						key={`${target.policyType}:${target.targetType}`}
						className="flex items-center justify-between gap-3"
					>
						<dt className="text-muted-foreground uppercase">
							{target.policyType} {target.targetType}
						</dt>
						<dd
							className={`text-right tabular-nums ${target.breached ? "text-destructive" : ""}`}
						>
							{formatSlaTarget(target)}
						</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

function formatDuration(milliseconds: number) {
	const minutes = Math.ceil(milliseconds / 60_000);
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	return hours
		? `${hours}h${remainder ? ` ${remainder}m` : ""}`
		: `${minutes}m`;
}
