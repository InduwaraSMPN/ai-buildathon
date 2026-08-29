import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";

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
				<div className="overflow-x-auto border">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-b">
								<th className="p-3">Attempted</th>
								<th className="p-3">Recipient</th>
								<th className="p-3">Subject</th>
								<th className="p-3">Subsystem</th>
								<th className="p-3">Outcome</th>
							</tr>
						</thead>
						<tbody>
							{entries.map((entry) => (
								<tr key={entry.id} className="border-b">
									<td className="p-3">{entry.attemptedAt.toLocaleString()}</td>
									<td className="p-3">{entry.recipient}</td>
									<td className="p-3 font-medium">{entry.subject}</td>
									<td className="p-3">{entry.subsystem}</td>
									<td className="p-3">
										<Badge
											variant={
												entry.outcome === "failed" ? "destructive" : "outline"
											}
										>
											{entry.outcome}
										</Badge>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<PageState
					kind="empty"
					title="No mail attempts"
					description="No delivery attempts have been recorded."
				/>
			)}
			<section className="mt-6 space-y-3">
				<h2 className="font-semibold">Inbound activity</h2>
				{activity.length ? (
					<div className="overflow-x-auto border">
						<table className="w-full text-left text-sm">
							<tbody>
								{activity.map((entry) => (
									<tr key={entry.id} className="border-b">
										<td className="p-3">{entry.createdAt.toLocaleString()}</td>
										<td className="p-3">{entry.mailboxId}</td>
										<td className="p-3">{entry.decision}</td>
										<td className="p-3">{entry.reason}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<p className="text-muted-foreground text-sm">
						No inbound activity recorded.
					</p>
				)}
			</section>
		</PageContainer>
	);
}
