import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageShell } from "@/components/ticket-ui";
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
