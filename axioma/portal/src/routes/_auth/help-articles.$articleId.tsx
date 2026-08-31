import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/ticket-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { KnowledgeArticle } from "@/features/knowledge/components";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/help-articles/$articleId")({
	component: ArticleRoute,
	head: () => ({ meta: [{ title: "Help article · Axiōma" }] }),
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
				<div
					className="flex flex-col gap-4"
					role="status"
					aria-label="Loading article"
				>
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-10 w-3/4" />
					<Skeleton className="h-48 w-full" />
				</div>
			</PageShell>
		);
	}
	if (query.isError && query.data == null) {
		return (
			<PageShell>
				<Alert variant="destructive">
					<AlertTitle>Could not load article</AlertTitle>
					<AlertDescription>{query.error.message}</AlertDescription>
					<Button
						variant="outline"
						className="mt-3 w-fit"
						onClick={() => query.refetch()}
					>
						Try again
					</Button>
				</Alert>
			</PageShell>
		);
	}
	if (!query.data) {
		return (
			<PageShell>
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>Article not found</EmptyTitle>
						<EmptyDescription>
							This help article may have been moved or removed.
						</EmptyDescription>
					</EmptyHeader>
					<Button
						variant="outline"
						onClick={() => void navigate({ to: "/help-articles" })}
					>
						Back to help articles
					</Button>
				</Empty>
			</PageShell>
		);
	}
	return (
		<PageShell>
			<KnowledgeArticle
				article={query.data}
				onBack={() => void navigate({ to: "/help-articles" })}
			/>
		</PageShell>
	);
}
