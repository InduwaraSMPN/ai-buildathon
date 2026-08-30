import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LoadingCards, PageShell } from "@/components/ticket-ui";
import { Button } from "@/components/ui/button";
import { KnowledgeBrowser } from "@/features/knowledge/components";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/knowledge")({
	component: KnowledgeRoute,
});
function KnowledgeRoute() {
	const [query, setQuery] = useState("");
	const navigate = useNavigate();
	const articles = useQuery(orpc.listPublicKnowledge.queryOptions());
	const filtered = useMemo(
		() =>
			(articles.data ?? []).filter((item) =>
				`${item.title} ${item.summary ?? ""}`
					.toLocaleLowerCase()
					.includes(query.toLocaleLowerCase()),
			),
		[articles.data, query],
	);
	if (articles.isPending && articles.data == null) {
		return (
			<PageShell>
				<LoadingCards />
			</PageShell>
		);
	}
	if (articles.isError && articles.data == null) {
		return (
			<PageShell>
				<div
					className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-card p-6"
					role="alert"
				>
					<p className="font-semibold">Help articles unavailable</p>
					<p className="text-muted-foreground text-sm">
						{articles.error.message}
					</p>
					<div>
						<Button variant="outline" onClick={() => articles.refetch()}>
							Try again
						</Button>
					</div>
				</div>
			</PageShell>
		);
	}
	return (
		<PageShell>
			<KnowledgeBrowser
				articles={filtered}
				query={query}
				onQueryChange={setQuery}
				onArticleSelect={(article) =>
					void navigate({
						to: "/knowledge/$articleId",
						params: { articleId: article.id },
					})
				}
			/>
		</PageShell>
	);
}
