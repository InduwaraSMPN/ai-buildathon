import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
	return query.data ? (
		<ProblemDetailPage problem={query.data} />
	) : (
		<p className="p-6">Problem not found.</p>
	);
}
