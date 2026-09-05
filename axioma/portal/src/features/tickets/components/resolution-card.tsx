import { RiCheckLine } from "@remixicon/react";
import { useState } from "react";
import { formatDate } from "@/components/ticket-ui";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	ResolutionActions,
	type TicketAction,
} from "@/features/tickets/components/resolution-actions";
import { resolutionCopy } from "@/features/tickets/copy";

export function ResolutionCard({
	ticket,
	pending,
	onAction,
}: {
	ticket: {
		id: string;
		statusStateType: string;
		escalationFlag: "none" | "warning" | "breach";
		resolution: string | null;
		resolvedAt: Date | null;
		closedAt: Date | null;
	};
	pending: boolean;
	onAction: (input: TicketAction) => Promise<unknown>;
}) {
	const [confirmingReopen, setConfirmingReopen] = useState(false);
	const resolved = ticket.statusStateType === "resolved";
	const escalated = ticket.escalationFlag !== "none";

	if (ticket.statusStateType === "closed") {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{resolutionCopy.closedTitle}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-1 text-muted-foreground text-sm">
					{ticket.resolvedAt ? (
						<p>
							{resolutionCopy.fixed} {formatDate(ticket.resolvedAt)}
						</p>
					) : null}
					{ticket.closedAt ? (
						<p>
							{resolutionCopy.confirmedClosed} {formatDate(ticket.closedAt)}
						</p>
					) : null}
					<div className="pt-3">
						<Button
							variant="outline"
							size="sm"
							disabled={pending}
							onClick={() => setConfirmingReopen(true)}
						>
							{resolutionCopy.reopen}
						</Button>
					</div>
				</CardContent>
				<AlertDialog open={confirmingReopen} onOpenChange={setConfirmingReopen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{resolutionCopy.reopenTitle}</AlertDialogTitle>
							<AlertDialogDescription>
								{resolutionCopy.reopenDescription}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>{resolutionCopy.keepClosed}</AlertDialogCancel>
							<AlertDialogAction
								disabled={pending}
								onClick={() => {
									setConfirmingReopen(false);
									onAction({ id: ticket.id, action: "reopen" });
								}}
							>
								{resolutionCopy.reopen}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</Card>
		);
	}

	if (!resolved && !escalated) return null;

	return (
		<Card
			className={
				resolved
					? "border-success/20 bg-success/5"
					: "border-warning/20 bg-warning/5"
			}
		>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<RiCheckLine
						className={resolved ? "text-success" : "text-warning"}
						aria-hidden="true"
					/>
					{resolved
						? resolutionCopy.resolvedTitle
						: resolutionCopy.escalatedTitle}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-5">
				{ticket.resolution ? (
					<p className="whitespace-pre-wrap text-sm leading-7">
						{ticket.resolution}
					</p>
				) : null}
				{escalated ? (
					<p className="text-muted-foreground text-sm leading-6">
						{resolutionCopy.escalatedDescription}
					</p>
				) : null}
				{ticket.resolvedAt ? (
					<p className="text-muted-foreground text-xs">
						{resolutionCopy.fixed} {formatDate(ticket.resolvedAt)}
					</p>
				) : null}
				<ResolutionActions
					ticket={ticket}
					pending={pending}
					onAction={onAction}
					className="flex-col-reverse sm:flex-row"
				/>
			</CardContent>
		</Card>
	);
}
