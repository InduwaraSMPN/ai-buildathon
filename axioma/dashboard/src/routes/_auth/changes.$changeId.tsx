import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
	return query.data ? (
		<ChangeDetailPage
			change={query.data}
			pending={vote.isPending || update.isPending}
			onVote={(value) => vote.mutate({ changeId, vote: value })}
			onUpdate={(value) => update.mutate({ id: changeId, ...value })}
		/>
	) : (
		<p className="p-6">Change not found.</p>
	);
}
