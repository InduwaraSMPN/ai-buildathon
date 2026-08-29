import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/ticket-ui";
import { KnowledgeArticle } from "@/features/knowledge/components";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/knowledge/$articleId")({
	component: ArticleRoute,
});
function ArticleRoute() {
	const { articleId } = Route.useParams();
	const navigate = useNavigate();
	const query = useQuery(
		orpc.getPublicKnowledgeArticle.queryOptions({ input: { id: articleId } }),
	);
	return (
		<PageShell>
			{query.data ? (
				<KnowledgeArticle
					article={query.data}
					onBack={() => void navigate({ to: "/knowledge" })}
				/>
			) : (
				<p>Article not found.</p>
			)}
		</PageShell>
	);
}
