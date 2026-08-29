import { Check } from "lucide-react";
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
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

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
		status: string;
		resolution: string | null;
		resolvedAt: Date | null;
		closedAt: Date | null;
		reopenedAt: Date | null;
	};
	pending: boolean;
	onAction: (input: TicketAction) => void;
}) {
	const [note, setNote] = useState("");
	const canEscalate =
		ticket.status === "resolved" || ticket.status === "escalated";
	const trimmedNote = note.trim();
	const canReopen =
		ticket.status === "closed" &&
		!ticket.reopenedAt &&
		!!ticket.closedAt &&
		Date.now() - new Date(ticket.closedAt).getTime() <= 7 * 24 * 60 * 60 * 1000;

	if (ticket.status === "closed") {
		return (
			<Card className="rounded-xl">
				<CardHeader>
					<CardTitle>Request closed</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-1 text-muted-foreground text-sm">
						{ticket.resolvedAt ? (
							<p>Fixed {formatDate(ticket.resolvedAt)}</p>
						) : null}
						{ticket.closedAt ? (
							<p>Confirmed closed {formatDate(ticket.closedAt)}</p>
						) : null}
					</div>
					{canReopen ? (
						<AlertDialog>
							<AlertDialogTrigger render={<Button variant="outline" />}>
								Reopen request
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Reopen this request?</AlertDialogTitle>
									<AlertDialogDescription>
										We’ll move it back into the support queue.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Keep closed</AlertDialogCancel>
									<AlertDialogAction
										disabled={pending}
										onClick={() =>
											onAction({ id: ticket.id, action: "reopen" })
										}
									>
										Reopen request
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					) : null}
				</CardContent>
			</Card>
		);
	}

	if (!canEscalate) return null;

	return (
		<Card className="rounded-xl border-emerald-500/20 bg-emerald-500/5">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Check className="size-5 text-emerald-600" aria-hidden="true" />
					{ticket.status === "resolved"
						? "What changed"
						: "A specialist is helping"}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-5">
				{ticket.resolution ? (
					<p className="whitespace-pre-wrap text-sm leading-7">
						{ticket.resolution}
					</p>
				) : null}
				{ticket.status === "escalated" ? (
					<p className="text-muted-foreground text-sm leading-6">
						A person is now handling your request. They’ll review the details
						and follow up when there’s an update.
					</p>
				) : null}
				{ticket.resolvedAt ? (
					<p className="text-muted-foreground text-xs">
						Fixed {formatDate(ticket.resolvedAt)}
					</p>
				) : null}

				<div className="space-y-3 border-t pt-5">
					<label htmlFor="escalation-note" className="font-medium text-sm">
						{ticket.status === "resolved"
							? "What is still wrong?"
							: "What else should the specialist know?"}
					</label>
					<Textarea
						id="escalation-note"
						value={note}
						onChange={(event) => setNote(event.target.value)}
						maxLength={2_000}
						placeholder="Add a short note"
						className="min-h-24 rounded-md bg-background text-sm"
					/>
					<div className="flex flex-col gap-2 sm:flex-row">
						{ticket.status === "resolved" ? (
							<AlertDialog>
								<AlertDialogTrigger render={<Button />}>
									<Check aria-hidden="true" /> This solved it
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Close this request?</AlertDialogTitle>
										<AlertDialogDescription>
											Confirm that the solution worked and this request can be
											closed.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Go back</AlertDialogCancel>
										<AlertDialogAction
											disabled={pending}
											onClick={() =>
												onAction({ id: ticket.id, action: "close" })
											}
										>
											Close request
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						) : null}
						<Button
							variant="outline"
							disabled={pending || !trimmedNote}
							onClick={() => {
								onAction({
									id: ticket.id,
									action: "escalate",
									note: trimmedNote,
								});
								setNote("");
							}}
						>
							{ticket.status === "resolved"
								? "This didn’t fix it"
								: "Send more detail"}
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
