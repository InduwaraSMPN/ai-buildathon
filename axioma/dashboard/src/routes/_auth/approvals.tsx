import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageState } from "@/components/support-ui";
import { ApprovalsPage } from "@/features/approvals/components/approvals";
import { requireNav } from "@/lib/navigation";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/approvals")({
	component: ApprovalsRoute,
	beforeLoad: ({ context }) => {
		requireNav("/approvals", context);
		return { breadcrumb: "Approvals" };
	},
	head: () => ({ meta: [{ title: "Approvals · Axiōma" }] }),
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
	if (query.isPending && query.data == null) {
		return (
			<PageState
				kind="loading"
				title="Loading approvals"
				description="Retrieving approvals…"
			/>
		);
	}
	if (query.isError && query.data == null) {
		return (
			<PageState
				kind="error"
				title="Approvals unavailable"
				description={query.error.message}
				onRetry={() => query.refetch()}
			/>
		);
	}
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
