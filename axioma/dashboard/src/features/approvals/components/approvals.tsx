import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

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
	if (approvals.length === 0)
		return (
			<p className="py-12 text-center text-muted-foreground text-sm">
				No approvals found.
			</p>
		);
	return (
		<div className="border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Request</TableHead>
						<TableHead>Requester</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Requested</TableHead>
						<TableHead className="text-right">Decision</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{approvals.map((approval) => (
						<TableRow key={approval.id}>
							<TableCell>
								<div className="font-medium">{approval.ticketId}</div>
								<div className="max-w-sm truncate text-muted-foreground">
									{approval.requestNote ?? "No request note"}
								</div>
							</TableCell>
							<TableCell>{approval.requesterId}</TableCell>
							<TableCell>
								<Badge
									variant={
										approval.status === "rejected"
											? "destructive"
											: approval.status === "approved"
												? "default"
												: "secondary"
									}
								>
									{approval.status.replaceAll("_", " ")}
								</Badge>
							</TableCell>
							<TableCell>
								{new Date(approval.requestedAt).toLocaleString()}
							</TableCell>
							<TableCell>
								<div className="flex justify-end gap-2">
									{approval.status === "waiting_for_approval" && onDecide ? (
										<>
											<Button
												size="sm"
												disabled={pendingId === approval.id}
												onClick={() => onDecide(approval, "approved")}
											>
												Approve
											</Button>
											<Button
												size="sm"
												variant="destructive"
												disabled={pendingId === approval.id}
												onClick={() => onDecide(approval, "rejected")}
											>
												Reject
											</Button>
										</>
									) : (
										<span className="text-muted-foreground">
											{approval.decisionNote ?? "Decided"}
										</span>
									)}
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
