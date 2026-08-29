import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export type ScheduledWork = {
	ticketId: string;
	ticketNumber: string | null;
	title: string;
	status: string;
	priority: string;
	workStartAt: Date | null;
	workEndAt: Date | null;
	workAllDay: boolean;
	snoozedUntil: Date | null;
};

export function CalendarPage({ work }: { work: readonly ScheduledWork[] }) {
	return (
		<PageContainer
			title="Scheduled work"
			description="Upcoming changes, maintenance, and recurring work."
		>
			{work.length ? (
				<div className="grid gap-3">
					{work.map((item) => (
						<Card key={item.ticketId}>
							<CardContent className="flex items-start justify-between gap-4 p-4">
								<div>
									<p className="font-medium">
										{item.ticketNumber ?? item.ticketId} · {item.title}
									</p>
									<p className="text-muted-foreground text-xs">
										{item.priority} · {item.status}
									</p>
									<p className="text-muted-foreground text-sm">
										{item.workStartAt?.toLocaleString()}
										{item.workEndAt
											? ` – ${item.workEndAt.toLocaleString()}`
											: ""}
									</p>
								</div>
								<Badge variant="outline">
									{item.workAllDay ? "All day" : "Scheduled"}
									{item.snoozedUntil
										? ` · Snoozed until ${item.snoozedUntil.toLocaleString()}`
										: ""}
								</Badge>
							</CardContent>
						</Card>
					))}
				</div>
			) : (
				<PageState
					kind="empty"
					title="No scheduled work"
					description="No work is scheduled in this period."
				/>
			)}
		</PageContainer>
	);
}
