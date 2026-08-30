import type { TicketSlaTarget } from "../api/types";
import { formatSlaTarget } from "./sla-format";

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
