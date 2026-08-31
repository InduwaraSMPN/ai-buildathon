import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageState } from "@/components/support-ui";
import {
	KnowledgeArticleEditor,
	KnowledgePage,
} from "@/features/knowledge/components/knowledge";
import { requireNav } from "@/lib/navigation";
import { orpc } from "@/utils/orpc";
import { selectQueryState } from "@/utils/query-state";

export const Route = createFileRoute("/_auth/knowledge/")({
	component: KnowledgeRoute,
	beforeLoad: ({ context }) => {
		requireNav("/knowledge", context);
		return { breadcrumb: "Knowledge" };
	},
	head: () => ({ meta: [{ title: "Knowledge · Axiōma" }] }),
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
	const state = selectQueryState(query);
	if (state.kind === "loading") {
		return (
			<PageState
				kind="loading"
				title="Loading knowledge"
				description="Retrieving knowledge articles…"
			/>
		);
	}
	if (state.kind === "error") {
		return (
			<PageState
				kind="error"
				title="Knowledge unavailable"
				description={state.error?.message ?? "Try again shortly."}
				onRetry={() => query.refetch()}
			/>
		);
	}
	return (
		<KnowledgePage
			articles={state.kind === "content" ? state.data : []}
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
