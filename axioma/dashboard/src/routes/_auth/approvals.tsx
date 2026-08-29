import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ApprovalsPage } from "@/features/approvals/components/approvals";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/approvals")({
	component: ApprovalsRoute,
	beforeLoad: () => ({ breadcrumb: "Approvals" }),
});
function ApprovalsRoute() {
	const client = useQueryClient();
	const query = useQuery(orpc.listApprovals.queryOptions());
	const decide = useMutation(
		orpc.decideApproval.mutationOptions({
			onSuccess: () =>
				client.invalidateQueries({ queryKey: orpc.listApprovals.key() }),
		}),
	);
	return (
		<ApprovalsPage
			approvals={query.data ?? []}
			pendingId={decide.variables?.id}
			onDecide={(approval, decision) =>
				decide.mutate({ id: approval.id, decision })
			}
		/>
	);
}
