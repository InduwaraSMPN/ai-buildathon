import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { KnowledgePage } from "@/features/knowledge/components/knowledge";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/knowledge")({
	component: KnowledgeRoute,
	beforeLoad: () => ({ breadcrumb: "Knowledge" }),
});
function KnowledgeRoute() {
	const query = useQuery(orpc.listKnowledgeArticles.queryOptions());
	return <KnowledgePage articles={query.data ?? []} />;
}
