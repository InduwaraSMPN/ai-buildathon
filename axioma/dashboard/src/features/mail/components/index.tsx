import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export type MailLogRow = {
	id: string;
	recipient: string;
	subject: string;
	subsystem: string;
	outcome: "sent" | "failed";
	attemptedAt: Date;
};
export type MailboxActivityRow = {
	id: string;
	mailboxId: string;
	decision: string;
	reason: string;
	createdAt: Date;
};

function decisionLabel(decision: string) {
	const labels: Record<string, string> = {
		threaded: "Threaded",
		ticket_created: "Ticket created",
		auto_reply_suppressed: "Auto-reply suppressed",
		duplicate_ignored: "Duplicate ignored",
		failed: "Failed",
	};
	return labels[decision] ?? (decision || "Unknown decision");
}

export function MailLogPage({
	entries,
	activity,
}: {
	entries: readonly MailLogRow[];
	activity: readonly MailboxActivityRow[];
}) {
	return (
		<PageContainer
			title="Mail send log"
			description="Inspect successful and failed delivery attempts."
		>
			{entries.length ? (
				<Card>
					<CardHeader>
						<CardTitle>Outbound</CardTitle>
						<CardDescription>
							Delivery attempts made by Axiōma subsystems.
						</CardDescription>
					</CardHeader>
					<CardContent className="px-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Attempted</TableHead>
									<TableHead>Recipient</TableHead>
									<TableHead>Subject</TableHead>
									<TableHead>Subsystem</TableHead>
									<TableHead>Outcome</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{entries.map((entry) => (
									<TableRow key={entry.id}>
										<TableCell>{entry.attemptedAt.toLocaleString()}</TableCell>
										<TableCell>{entry.recipient}</TableCell>
										<TableCell className="font-medium">{entry.subject}</TableCell>
										<TableCell>{entry.subsystem}</TableCell>
										<TableCell>
											<Badge
												variant={
													entry.outcome === "failed" ? "destructive" : "outline"
												}
											>
												{entry.outcome}
											</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			) : (
				<PageState
					kind="empty"
					title="No mail attempts"
					description="No delivery attempts have been recorded."
				/>
			)}
			{activity.length ? (
				<Card className="mt-4">
					<CardHeader>
						<CardTitle>Inbound activity</CardTitle>
						<CardDescription>
							Messages received and how each was routed.
						</CardDescription>
					</CardHeader>
					<CardContent className="px-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Received</TableHead>
									<TableHead>Mailbox</TableHead>
									<TableHead>Decision</TableHead>
									<TableHead>Reason</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{activity.map((entry) => (
									<TableRow key={entry.id}>
										<TableCell>{entry.createdAt.toLocaleString()}</TableCell>
										<TableCell>{entry.mailboxId}</TableCell>
										<TableCell>{decisionLabel(entry.decision)}</TableCell>
										<TableCell>{entry.reason}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			) : (
				<PageState
					kind="empty"
					title="No inbound activity"
					description="No inbound activity has been recorded."
				/>
			)}
		</PageContainer>
	);
}
