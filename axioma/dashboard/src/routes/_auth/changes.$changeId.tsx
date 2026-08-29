import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChangeDetailPage } from "@/features/changes/components/changes";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/changes/$changeId")({
	component: ChangeRoute,
});
function ChangeRoute() {
	const { changeId } = Route.useParams();
	const query = useQuery(
		orpc.getChange.queryOptions({ input: { id: changeId } }),
	);
	return query.data ? (
		<ChangeDetailPage change={query.data} />
	) : (
		<p className="p-6">Change not found.</p>
	);
}
