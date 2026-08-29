import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ProblemEditor,
	ProblemsPage,
} from "@/features/problems/components/problems";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/problems")({
	component: ProblemsRoute,
	beforeLoad: () => ({ breadcrumb: "Problems" }),
});
function ProblemsRoute() {
	const queryClient = useQueryClient();
	const query = useQuery(orpc.listProblems.queryOptions());
	const navigate = useNavigate();
	const create = useMutation(
		orpc.createProblem.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: orpc.listProblems.key() }),
		}),
	);
	return (
		<ProblemsPage
			problems={query.data ?? []}
			action={
				<ProblemEditor
					pending={create.isPending}
					onSubmit={(value) => create.mutate(value)}
				/>
			}
			onSelect={(problem) =>
				void navigate({
					to: "/problems/$problemId",
					params: { problemId: problem.id },
				})
			}
		/>
	);
}
