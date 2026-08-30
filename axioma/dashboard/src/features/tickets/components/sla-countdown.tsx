import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TicketSlaTarget } from "../api/types";
import { formatSlaTarget } from "./sla-format";

export function SlaCountdown({ targets }: { targets: TicketSlaTarget[] }) {
	if (!targets.length) return null;
	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>Service levels</CardTitle>
			</CardHeader>
			<CardContent>
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
			</CardContent>
		</Card>
	);
}
