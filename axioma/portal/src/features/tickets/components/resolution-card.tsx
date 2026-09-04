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
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { resolutionCopy } from "@/features/tickets/copy";

type TicketAction =
	| { id: string; action: "close" }
	| { id: string; action: "reopen" }
	| { id: string; action: "escalate"; note: string };

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
	onAction: (input: TicketAction) => void;
}) {
	// One flag per surface rather than a shared "open dialog" value: the note
	// dialog carries its own draft, and reusing one flag closed the wrong one.
	const [confirmingClose, setConfirmingClose] = useState(false);
	const [confirmingReopen, setConfirmingReopen] = useState(false);
	const [noteOpen, setNoteOpen] = useState(false);
	const [note, setNote] = useState("");

	const resolved = ticket.statusStateType === "resolved";
	const escalated = ticket.escalationFlag !== "none";

	const sendNote = () => {
		const trimmed = note.trim();
		if (!trimmed) return;
		onAction({ id: ticket.id, action: "escalate", note: trimmed });
		setNote("");
		setNoteOpen(false);
	};

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
				{/* A resolution the reporter has to accept or reject is the whole
				    point of this card; without these the request could only be
				    closed by support. */}
				<div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
					{resolved ? (
						<>
							<Button
								variant="outline"
								disabled={pending}
								onClick={() => setNoteOpen(true)}
							>
								{resolutionCopy.notFixed}
							</Button>
							<Button
								disabled={pending}
								onClick={() => setConfirmingClose(true)}
							>
								{resolutionCopy.solved}
							</Button>
						</>
					) : (
						<Button
							variant="outline"
							disabled={pending}
							onClick={() => setNoteOpen(true)}
						>
							{resolutionCopy.sendDetail}
						</Button>
					)}
				</div>
			</CardContent>

			<AlertDialog open={confirmingClose} onOpenChange={setConfirmingClose}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{resolutionCopy.closeTitle}</AlertDialogTitle>
						<AlertDialogDescription>
							{resolutionCopy.closeDescription}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{resolutionCopy.goBack}</AlertDialogCancel>
						<AlertDialogAction
							disabled={pending}
							onClick={() => {
								setConfirmingClose(false);
								onAction({ id: ticket.id, action: "close" });
							}}
						>
							{resolutionCopy.close}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog open={noteOpen} onOpenChange={setNoteOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{resolved ? resolutionCopy.notFixed : resolutionCopy.sendDetail}
						</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							sendNote();
						}}
					>
						<Field>
							<FieldLabel htmlFor="resolution-note">
								{resolved
									? resolutionCopy.resolvedNoteLabel
									: resolutionCopy.escalatedNoteLabel}
							</FieldLabel>
							<Textarea
								id="resolution-note"
								value={note}
								onChange={(event) => setNote(event.target.value)}
								maxLength={2_000}
								placeholder={resolutionCopy.notePlaceholder}
								className="min-h-24"
							/>
						</Field>
						<DialogFooter>
							<Button type="submit" disabled={pending || !note.trim()}>
								{resolutionCopy.sendDetail}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
