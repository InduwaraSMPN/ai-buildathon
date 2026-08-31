import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type ApprovalSummary = {
	id: string;
	requesterId: string;
	approverId: string;
	ticketId: string;
	status: "waiting_for_approval" | "approved" | "rejected";
	requestNote: string | null;
	decisionNote: string | null;
	requestedAt: Date | string;
};

export function ApprovalsPage(props: {
	approvals: readonly ApprovalSummary[];
	pendingId?: string;
	onDecide?: (
		approval: ApprovalSummary,
		decision: "approved" | "rejected",
	) => void;
}) {
	return (
		<PageContainer
			title="Approvals"
			description="Review and decide pending service requests."
		>
			<ApprovalList {...props} />
		</PageContainer>
	);
}

const approvalColumn = createColumnHelper<ApprovalSummary>();

function approvalColumns(
	pendingId: string | undefined,
	onDecide:
		| ((approval: ApprovalSummary, decision: "approved" | "rejected") => void)
		| undefined,
) {
	return [
		approvalColumn.accessor("ticketId", {
			header: "Request",
			size: 30,
			cell: ({ row }) => (
				<div>
					<div className="font-medium">{row.original.ticketId}</div>
					<div className="text-muted-foreground">
						{row.original.requestNote ?? "No request note"}
					</div>
				</div>
			),
		}),
		approvalColumn.accessor("requesterId", { header: "Requester", size: 18 }),
		approvalColumn.accessor(
			(approval) => approval.status.replaceAll("_", " "),
			{
				id: "status",
				header: "Status",
				size: 14,
				cell: ({ row }) => (
					<Badge
						variant={
							row.original.status === "rejected"
								? "destructive"
								: row.original.status === "approved"
									? "default"
									: "secondary"
						}
					>
						{row.original.status.replaceAll("_", " ")}
					</Badge>
				),
			},
		),
		approvalColumn.accessor(
			(approval) => new Date(approval.requestedAt).getTime(),
			{
				id: "requested",
				header: "Requested",
				size: 18,
				cell: ({ row }) =>
					new Date(row.original.requestedAt).toLocaleString(),
			},
		),
		approvalColumn.display({
			id: "decision",
			header: "Decision",
			size: 20,
			cell: ({ row }) => (
				<div className="flex flex-wrap justify-end gap-2">
					{row.original.status === "waiting_for_approval" && onDecide ? (
						<>
							<Button
								size="sm"
								disabled={pendingId === row.original.id}
								onClick={() => onDecide(row.original, "approved")}
							>
								Approve
							</Button>
							<Button
								size="sm"
								variant="destructive"
								disabled={pendingId === row.original.id}
								onClick={() => onDecide(row.original, "rejected")}
							>
								Reject
							</Button>
						</>
					) : (
						<span className="text-muted-foreground">
							{row.original.decisionNote ?? "Decided"}
						</span>
					)}
				</div>
			),
		}),
	];
}

export function ApprovalList({
	approvals,
	pendingId,
	onDecide,
}: {
	approvals: readonly ApprovalSummary[];
	pendingId?: string;
	onDecide?: (
		approval: ApprovalSummary,
		decision: "approved" | "rejected",
	) => void;
}) {
	const columns = approvalColumns(pendingId, onDecide);
	return (
		<DataTable
			data={approvals}
			columns={columns}
			filterLabel="Filter approvals"
			filterPlaceholder="Filter ticket, requester, or status…"
			emptyTitle="No approvals found"
			emptyDescription="Approval requests will appear here when they need a decision."
		/>
	);
}
