import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { KnowledgeArticleEditor } from "@/features/knowledge/components/knowledge";
import { orpc } from "@/utils/orpc";

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
	return query.data ? (
		<KnowledgeArticleEditor
			initial={query.data}
			pending={update.isPending}
			onSubmit={(value) => update.mutate({ id: articleId, ...value })}
		/>
	) : (
		<p className="p-6">Article not found.</p>
	);
}
