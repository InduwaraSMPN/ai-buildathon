import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { PageContainer } from "@/components/layout/page-container";
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

/**
 * Mirrors MAILBOX_ACTIVITY_DECISIONS in axioma/api/src/db/schema/mail.ts. The
 * contract types this field as a plain string, so the vocabulary cannot be
 * imported — keep this map in step when a decision is added there. "rejected"
 * was missing and rendered as its raw lowercase key beside labelled siblings.
 */
function decisionLabel(decision: string) {
	const labels: Record<string, string> = {
		threaded: "Threaded",
		ticket_created: "Ticket created",
		auto_reply_suppressed: "Auto-reply suppressed",
		duplicate_ignored: "Duplicate ignored",
		rejected: "Rejected",
		failed: "Failed",
	};
	return labels[decision] ?? (decision || "Unknown decision");
}

const sendColumn = createColumnHelper<MailLogRow>();
const sendColumns = [
	// Sorts on the timestamp, displays the formatted date.
	sendColumn.accessor((entry) => entry.attemptedAt.getTime(), {
		id: "attempted",
		header: "Attempted",
		size: 18,
		cell: ({ row }) => row.original.attemptedAt.toLocaleString(),
	}),
	sendColumn.accessor("recipient", { header: "Recipient", size: 22 }),
	sendColumn.accessor("subject", {
		header: "Subject",
		size: 32,
		cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
	}),
	sendColumn.accessor("subsystem", { header: "Subsystem", size: 16 }),
	sendColumn.accessor("outcome", {
		header: "Outcome",
		size: 12,
		cell: ({ getValue }) => (
			<Badge variant={getValue() === "failed" ? "destructive" : "outline"}>
				{getValue()}
			</Badge>
		),
	}),
];

const activityColumn = createColumnHelper<MailboxActivityRow>();
const activityColumns = [
	activityColumn.accessor((entry) => entry.createdAt.getTime(), {
		id: "received",
		header: "Received",
		size: 20,
		cell: ({ row }) => row.original.createdAt.toLocaleString(),
	}),
	activityColumn.accessor("mailboxId", { header: "Mailbox", size: 20 }),
	activityColumn.accessor((entry) => decisionLabel(entry.decision), {
		id: "decision",
		header: "Decision",
		size: 20,
	}),
	activityColumn.accessor("reason", { header: "Reason", size: 40 }),
];

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
			<section className="flex flex-col gap-2">
				<h2 className="font-medium text-sm">Outbound</h2>
				<DataTable
					data={entries}
					columns={sendColumns}
					filterLabel="Filter delivery attempts"
					filterPlaceholder="Filter recipient, subject, or subsystem…"
					emptyTitle="No mail attempts"
					emptyDescription="No delivery attempts have been recorded."
				/>
			</section>
			<section className="mt-6 flex flex-col gap-2">
				<h2 className="font-medium text-sm">Inbound activity</h2>
				<DataTable
					data={activity}
					columns={activityColumns}
					filterLabel="Filter inbound activity"
					filterPlaceholder="Filter mailbox, decision, or reason…"
					emptyTitle="No inbound activity"
					emptyDescription="No inbound activity has been recorded."
				/>
			</section>
		</PageContainer>
	);
}
