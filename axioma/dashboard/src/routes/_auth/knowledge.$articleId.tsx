import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageState } from "@/components/support-ui";
import { KnowledgeArticleEditor } from "@/features/knowledge/components/knowledge";
import { orpc } from "@/utils/orpc";
import { selectQueryState } from "@/utils/query-state";

export const Route = createFileRoute("/_auth/knowledge/$articleId")({
	component: ArticleRoute,
});
function ArticleRoute() {
	const { articleId } = Route.useParams();
	const client = useQueryClient();
	const query = useQuery(
		orpc.getKnowledgeArticle.queryOptions({ input: { id: articleId } }),
	);
	const update = useMutation(
		orpc.updateKnowledgeArticle.mutationOptions({
			onSuccess: () =>
				client.invalidateQueries({
					queryKey: orpc.getKnowledgeArticle.key({ input: { id: articleId } }),
				}),
		}),
	);
	const state = selectQueryState(query);
	if (state.kind === "loading") {
		return (
			<PageState
				kind="loading"
				title="Loading article"
				description="Retrieving knowledge article…"
			/>
		);
	}
	if (state.kind === "error") {
		return (
			<PageState
				kind="error"
				title="Article unavailable"
				description={state.error?.message ?? "Try again shortly."}
				onRetry={() => query.refetch()}
			/>
		);
	}
	if (state.kind === "empty") {
		return (
			<PageState
				kind="empty"
				title="Article not found"
				description="This article may have been removed or the ID is incorrect."
			/>
		);
	}
	return (
		<KnowledgeArticleEditor
			initial={state.data}
			pending={update.isPending}
			onSubmit={(value) => update.mutate({ id: articleId, ...value })}
		/>
	);
}
