import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LoadingCards, PageHeading, PageShell } from "@/components/ticket-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { KnowledgeBrowser } from "@/features/knowledge/components";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/help-articles/")({
	component: KnowledgeRoute,
	head: () => ({ meta: [{ title: "Help articles · Axiōma" }] }),
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
				<Alert variant="destructive">
					<AlertTitle>Help articles unavailable</AlertTitle>
					<AlertDescription>{articles.error.message}</AlertDescription>
					<Button
						variant="outline"
						className="mt-3 w-fit"
						onClick={() => articles.refetch()}
					>
						Try again
					</Button>
				</Alert>
			</PageShell>
		);
	}
	return (
		<PageShell>
			<PageHeading
				eyebrow="Help centre"
				title="Help articles"
				description="Find clear steps for common questions and problems."
			/>
			<KnowledgeBrowser
				articles={filtered}
				query={query}
				onQueryChange={setQuery}
				onArticleSelect={(article) =>
					void navigate({
						to: "/help-articles/$articleId",
						params: { articleId: article.id },
					})
				}
			/>
		</PageShell>
	);
}
