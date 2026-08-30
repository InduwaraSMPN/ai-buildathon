import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	KnowledgeArticleEditor,
	KnowledgePage,
} from "@/features/knowledge/components/knowledge";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/knowledge/")({
	component: KnowledgeRoute,
	beforeLoad: () => ({ breadcrumb: "Knowledge" }),
});
function KnowledgeRoute() {
	const client = useQueryClient();
	const query = useQuery(orpc.listKnowledgeArticles.queryOptions());
	const navigate = useNavigate();
	const create = useMutation(
		orpc.createKnowledgeArticle.mutationOptions({
			onSuccess: () =>
				client.invalidateQueries({
					queryKey: orpc.listKnowledgeArticles.key(),
				}),
		}),
	);
	return (
		<KnowledgePage
			articles={query.data ?? []}
			onSelect={(article) =>
				void navigate({
					to: "/knowledge/$articleId",
					params: { articleId: article.id },
				})
			}
			action={
				<KnowledgeArticleEditor
					pending={create.isPending}
					onSubmit={(value) => create.mutate(value)}
				/>
			}
		/>
	);
}
