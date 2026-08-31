import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { TicketSlaTarget } from "../api/types";
import { formatSlaTarget } from "./sla-format";

/**
 * Elapsed working time against our own calendar.
 *
 * On a ticket owned by a foreign service desk this is relabelled, because it
 * is not that customer's SLA: their commitment is made in their system,
 * computed by their calendar, and reported by their tooling. Ours is a true
 * measure of how long we have been working, and calling it "the SLA" would be
 * asserting a commitment we are not party to. Nothing here is ever written
 * back for the same reason.
 */
export function SlaCountdown({
	targets,
	foreignOwned = false,
}: {
	targets: TicketSlaTarget[];
	foreignOwned?: boolean;
}) {
	if (!targets.length) return null;
	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>
					{foreignOwned ? "Axiōma working time" : "Service levels"}
				</CardTitle>
				{foreignOwned ? (
					<CardDescription>
						Not the customer's SLA — that is committed and measured in their
						system. This is how long this ticket has been worked here.
					</CardDescription>
				) : null}
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
