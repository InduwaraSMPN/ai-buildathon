import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type DeviceProposalSummary = {
	id: string;
	deviceId: string;
	deviceHostname: string | null;
	ticketId: string;
	command: string[];
	reason: string;
	status: "proposed" | "approved" | "rejected" | "expired" | "dispatched";
	decisionNote: string | null;
	expiresAt: Date | string;
	createdAt: Date | string;
};

/**
 * Pair each argument with its argv position so the rendered rows carry their
 * own identity. Two arguments in one command are frequently identical, so the
 * text alone cannot key the list; position is what distinguishes them, and it
 * belongs to the datum rather than to the render.
 */
function argvRows(proposal: DeviceProposalSummary) {
	return proposal.command.map((argument, position) => ({
		id: `${proposal.id}:${position}`,
		position,
		argument,
	}));
}

const TONE = {
	proposed: "secondary",
	approved: "default",
	dispatched: "default",
	rejected: "destructive",
	expired: "outline",
} as const;

export function DeviceProposalsPage(props: {
	proposals: readonly DeviceProposalSummary[];
	pendingId?: string;
	onDecide?: (
		proposal: DeviceProposalSummary,
		decision: "approved" | "rejected",
	) => void;
}) {
	return (
		<PageContainer
			title="Device commands"
			description="Axel proposes; nothing runs until someone here approves it. Read the command before you decide."
		>
			<DeviceProposalList {...props} />
		</PageContainer>
	);
}

export function DeviceProposalList({
	proposals,
	pendingId,
	onDecide,
}: {
	proposals: readonly DeviceProposalSummary[];
	pendingId?: string;
	onDecide?: (
		proposal: DeviceProposalSummary,
		decision: "approved" | "rejected",
	) => void;
}) {
	if (proposals.length === 0)
		return (
			<PageState
				kind="empty"
				title="No proposed commands"
				description="A command Axel wants to run on a device will appear here for a decision."
			/>
		);
	return (
		<div className="grid gap-4 md:grid-cols-2">
			{proposals.map((proposal) => (
				<Card key={proposal.id}>
					<CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
						<div>
							<span className="font-medium">
								{proposal.deviceHostname ?? proposal.deviceId}
							</span>
							<span className="text-muted-foreground">
								{" "}
								· {proposal.ticketId}
							</span>
						</div>
						<Badge variant={TONE[proposal.status]}>{proposal.status}</Badge>
					</CardHeader>
					<CardContent>
						{/*
						  The command, in full and never truncated, one argument per line.
						  Joining them into a single string would hide the boundary the
						  digest treats as load-bearing — ["a","b"] and ["a b"] are
						  different commands and must not look identical to the person
						  who is the entire gate. Inert text: never a link, never runnable
						  from here.
						*/}
						<ol className="flex flex-col gap-1 overflow-x-auto rounded-lg border bg-muted p-3 font-mono text-sm">
							{/*
							  argv position is part of the identity: repeated arguments are
							  legitimate and must stay distinct from one another. The position
							  is carried on the row itself rather than taken from the render
							  callback, so the key is derived from data instead of from where
							  the element happened to land in a list.
							*/}
							{argvRows(proposal).map((row) => (
								<li
									key={row.id}
									className="flex gap-3 whitespace-pre-wrap break-all"
								>
									<span className="shrink-0 text-muted-foreground">
										{row.position === 0 ? "program" : `arg ${row.position}`}
									</span>
									<span>{row.argument}</span>
								</li>
							))}
						</ol>

						<p className="mt-3 whitespace-pre-wrap text-muted-foreground">
							{proposal.reason}
						</p>
					</CardContent>
					<CardFooter className="flex flex-wrap items-center justify-between gap-2">
						<span className="text-muted-foreground text-sm">
							{proposal.status === "proposed"
								? `Expires ${new Date(proposal.expiresAt).toLocaleString()}`
								: (proposal.decisionNote ?? "Decided")}
						</span>
						{proposal.status === "proposed" && onDecide ? (
							<div className="flex gap-2">
								<Button
									size="sm"
									disabled={pendingId === proposal.id}
									onClick={() => onDecide(proposal, "approved")}
								>
									Approve and run
								</Button>
								<Button
									size="sm"
									variant="destructive"
									disabled={pendingId === proposal.id}
									onClick={() => onDecide(proposal, "rejected")}
								>
									Reject
								</Button>
							</div>
						) : null}
					</CardFooter>
				</Card>
			))}
		</div>
	);
}
