import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { orpc } from "@/utils/orpc";

/**
 * A shadow-mode proposal, above the step list.
 *
 * Three things are deliberate here, and each comes from a documented failure
 * mode rather than from taste.
 *
 * - **Accept and reject record agreement; they do not execute.** The
 *   environment forbids the write, so a button that acted would contradict the
 *   mode it is displayed in. The labels say so.
 * - **The unit of judgement is the call, not the proposal.** A reviewer who
 *   accepts the diagnosis and rejects one step should be able to say that; a
 *   single verdict would lose the signal and flatter the statistics in both
 *   directions.
 * - **Reject costs one click and gets no confirmation dialog.** Efficient
 *   dismissal is a published guideline, and the failure it guards against is
 *   the one the base rates predict: dismissal that costs a modal is dismissal
 *   that stops happening, after which every proposal reads as accepted.
 */
export function ProposalCard({ ticketId }: { ticketId: string }) {
	const queryClient = useQueryClient();
	const query = useQuery(
		orpc.getTicketProposal.queryOptions({ input: { ticketId } }),
	);
	const proposal = query.data;

	const opened = useMutation(orpc.markProposalOpened.mutationOptions({}));
	const record = useMutation(
		orpc.recordProposalVerdict.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.getTicketProposal.key(),
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	// Recorded on first render of the proposal, not on a click. Whether the
	// reviewer looked is the number that decides whether the agreement figures
	// mean anything, and requiring an extra interaction to record it would
	// undercount exactly the cases worth counting.
	const proposalId = proposal?.id;
	const alreadyOpened = proposal?.openedAt != null;
	useEffect(() => {
		if (proposalId && !alreadyOpened) opened.mutate({ proposalId });
	}, [proposalId, alreadyOpened, opened.mutate]);

	if (!proposal) return null;

	return (
		<Alert className="mb-3">
			<AlertTitle>Axel ran in shadow mode — nothing was changed</AlertTitle>
			<AlertDescription>
				{proposal.calls.length === 0
					? "Axel reached no action worth proposing on this ticket."
					: "Below is what Axel would have done, produced by the same code path that would have acted. Accepting or rejecting records your judgement for evaluation; it does not run anything."}
			</AlertDescription>

			{proposal.calls.length > 0 ? (
				<div className="mt-3 flex flex-col gap-3">
					{proposal.calls.map((call) => (
						<div key={call.ordinal} className="border p-3">
							<div className="flex items-center justify-between gap-3">
								<Badge variant="secondary" className="font-mono">
									{call.tool}
								</Badge>
								{call.verdict ? (
									<Badge
										tone={call.verdict === "accepted" ? "success" : "warning"}
									>
										{call.verdict}
									</Badge>
								) : (
									<span className="flex gap-2">
										<Button
											size="sm"
											variant="outline"
											disabled={record.isPending}
											onClick={() =>
												record.mutate({
													proposalId: proposal.id,
													callOrdinal: call.ordinal,
													verdict: "accepted",
													note: null,
												})
											}
										>
											I agree
										</Button>
										<Button
											size="sm"
											variant="ghost"
											disabled={record.isPending}
											onClick={() =>
												record.mutate({
													proposalId: proposal.id,
													callOrdinal: call.ordinal,
													verdict: "rejected",
													note: null,
												})
											}
										>
											I disagree
										</Button>
									</span>
								)}
							</div>
							<pre className="mt-2 overflow-x-auto bg-muted/30 p-2 font-mono text-xs">
								{JSON.stringify(call.input, null, 2)}
							</pre>
						</div>
					))}
				</div>
			) : null}
		</Alert>
	);
}
