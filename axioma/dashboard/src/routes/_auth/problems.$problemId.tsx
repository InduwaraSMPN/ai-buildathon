import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageState } from "@/components/support-ui";
import { ProblemDetailPage } from "@/features/problems/components/problems";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/problems/$problemId")({
	component: ProblemRoute,
});
function ProblemRoute() {
	const { problemId } = Route.useParams();
	const query = useQuery(
		orpc.getProblem.queryOptions({ input: { id: problemId } }),
	);
	if (query.isPending && query.data == null) {
		return (
			<PageState
				kind="loading"
				title="Loading problem"
				description="Retrieving problem details…"
			/>
		);
	}
	if (query.isError && query.data == null) {
		return (
			<PageState
				kind="error"
				title="Problem unavailable"
				description={query.error.message}
				onRetry={() => query.refetch()}
			/>
		);
	}
	if (!query.data) {
		return (
			<PageState
				kind="empty"
				title="Problem not found"
				description="This problem may have been removed or the ID is incorrect."
			/>
		);
	}
	return <ProblemDetailPage problem={query.data} />;
}
