import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProblemsPage } from "@/features/problems/components/problems";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/problems")({
	component: ProblemsRoute,
	beforeLoad: () => ({ breadcrumb: "Problems" }),
});
function ProblemsRoute() {
	const query = useQuery(orpc.listProblems.queryOptions());
	const navigate = useNavigate();
	return (
		<ProblemsPage
			problems={query.data ?? []}
			onSelect={(problem) =>
				void navigate({
					to: "/problems/$problemId",
					params: { problemId: problem.id },
				})
			}
		/>
	);
}
