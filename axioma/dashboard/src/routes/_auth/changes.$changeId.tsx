import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageState } from "@/components/support-ui";
import { ChangeDetailPage } from "@/features/changes/components/changes";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/changes/$changeId")({
	component: ChangeRoute,
});
function ChangeRoute() {
	const { changeId } = Route.useParams();
	const client = useQueryClient();
	const query = useQuery(
		orpc.getChange.queryOptions({ input: { id: changeId } }),
	);
	const vote = useMutation(
		orpc.voteOnChange.mutationOptions({
			onSuccess: () =>
				client.invalidateQueries({
					queryKey: orpc.getChange.key({ input: { id: changeId } }),
				}),
		}),
	);
	const update = useMutation(
		orpc.updateChange.mutationOptions({
			onSuccess: () =>
				client.invalidateQueries({
					queryKey: orpc.getChange.key({ input: { id: changeId } }),
				}),
		}),
	);
	if (query.isPending && query.data == null) {
		return (
			<PageState
				kind="loading"
				title="Loading change"
				description="Retrieving change details…"
			/>
		);
	}
	if (query.isError && query.data == null) {
		return (
			<PageState
				kind="error"
				title="Change unavailable"
				description={query.error.message}
				onRetry={() => query.refetch()}
			/>
		);
	}
	if (!query.data) {
		return (
			<PageState
				kind="empty"
				title="Change not found"
				description="This change may have been removed or the ID is incorrect."
			/>
		);
	}
	return (
		<ChangeDetailPage
			change={query.data}
			pending={vote.isPending || update.isPending}
			onVote={(value) => vote.mutate({ changeId, vote: value })}
			onUpdate={(value) => update.mutate({ id: changeId, ...value })}
		/>
	);
}
