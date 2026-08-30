import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

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
							<CardHeader>
								<CardTitle>
									{item.ticketNumber ?? item.ticketId} · {item.title}
								</CardTitle>
								<CardDescription>
									{item.priority} · {item.status}
								</CardDescription>
								<CardAction>
									<Badge variant="outline">
										{item.workAllDay ? "All day" : "Scheduled"}
									</Badge>
								</CardAction>
							</CardHeader>
							<CardContent className="text-muted-foreground text-sm">
								{item.workStartAt?.toLocaleString()}
								{item.workEndAt ? ` – ${item.workEndAt.toLocaleString()}` : ""}
								{item.snoozedUntil
									? ` · Snoozed until ${item.snoozedUntil.toLocaleString()}`
									: ""}
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
