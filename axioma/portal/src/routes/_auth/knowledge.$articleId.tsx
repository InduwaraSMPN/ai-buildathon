import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/ticket-ui";
import { Button } from "@/components/ui/button";
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
	if (query.isPending && query.data == null) {
		return (
			<PageShell>
				<p className="text-muted-foreground text-sm" role="status">
					Loading article…
				</p>
			</PageShell>
		);
	}
	if (query.isError && query.data == null) {
		return (
			<PageShell>
				<div
					className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-card p-6"
					role="alert"
				>
					<p className="font-semibold">Could not load article</p>
					<p className="text-muted-foreground text-sm">{query.error.message}</p>
					<div>
						<Button variant="outline" onClick={() => query.refetch()}>
							Try again
						</Button>
					</div>
				</div>
			</PageShell>
		);
	}
	if (!query.data) {
		return (
			<PageShell>
				<p>Article not found.</p>
			</PageShell>
		);
	}
	return (
		<PageShell>
			<KnowledgeArticle
				article={query.data}
				onBack={() => void navigate({ to: "/knowledge" })}
			/>
		</PageShell>
	);
}
