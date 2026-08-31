import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageState } from "@/components/support-ui";
import {
	ProblemEditor,
	ProblemsPage,
} from "@/features/problems/components/problems";
import { requireNav } from "@/lib/navigation";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/problems/")({
	component: ProblemsRoute,
	beforeLoad: ({ context }) => {
		requireNav("/problems", context);
		return { breadcrumb: "Problems" };
	},
	head: () => ({ meta: [{ title: "Problems · Axiōma" }] }),
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
	if (query.isPending && query.data == null) {
		return (
			<PageState
				kind="loading"
				title="Loading problems"
				description="Retrieving problems…"
			/>
		);
	}
	if (query.isError && query.data == null) {
		return (
			<PageState
				kind="error"
				title="Problems unavailable"
				description={query.error.message}
				onRetry={() => query.refetch()}
			/>
		);
	}
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
