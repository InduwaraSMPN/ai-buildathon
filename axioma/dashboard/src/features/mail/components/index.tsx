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

export function MailLogPage({ entries }: { entries: readonly MailLogRow[] }) {
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
		</PageContainer>
	);
}
