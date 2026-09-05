import { useId, useState } from "react";
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
import { cn } from "@/lib/utils";

export type TicketAction =
	| { id: string; action: "close" }
	| { id: string; action: "reopen" }
	| { id: string; action: "escalate"; note: string };

export function ResolutionActions({
	ticket,
	pending,
	onAction,
	className,
}: {
	ticket: { id: string; statusStateType: string };
	pending: boolean;
	onAction: (input: TicketAction) => Promise<unknown>;
	className?: string;
}) {
	const noteId = useId();
	const [confirmingClose, setConfirmingClose] = useState(false);
	const [noteOpen, setNoteOpen] = useState(false);
	const [note, setNote] = useState("");
	const resolved = ticket.statusStateType === "resolved";

	const sendNote = async () => {
		const trimmed = note.trim();
		if (!trimmed) return;
		await onAction({ id: ticket.id, action: "escalate", note: trimmed });
		setNote("");
		setNoteOpen(false);
	};

	return (
		<>
			<div
				className={cn(
					"flex flex-col gap-3 border-t pt-4 sm:flex-row sm:justify-end",
					className,
				)}
			>
				{resolved ? (
					<>
						<Button
							variant="outline"
							disabled={pending}
							onClick={() => setNoteOpen(true)}
						>
							{resolutionCopy.notFixed}
						</Button>
						<Button disabled={pending} onClick={() => setConfirmingClose(true)}>
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
							onClick={async () => {
								await onAction({ id: ticket.id, action: "close" });
								setConfirmingClose(false);
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
							void sendNote().catch(() => undefined);
						}}
					>
						<Field>
							<FieldLabel htmlFor={noteId}>
								{resolved
									? resolutionCopy.resolvedNoteLabel
									: resolutionCopy.escalatedNoteLabel}
							</FieldLabel>
							<Textarea
								id={noteId}
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
		</>
	);
}
