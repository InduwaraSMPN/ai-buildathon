import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageState } from "@/components/support-ui";
import { CmdbObjectPage } from "@/features/cmdb/components/cmdb-object";
import { orpc } from "@/utils/orpc";

/**
 * The destination of the `/cmdb/<id>` deep link that search emits for every
 * CMDB document. There is no CMDB browse page and no navigation entry — a
 * configuration item is reached from a search hit or from the ticket that
 * observed it — so this route guards nothing itself and leans on
 * `getCmdbObject`, which requires `ticket.read.all`.
 */
export const Route = createFileRoute("/_auth/cmdb/$objectId")({
	component: CmdbObjectRoute,
	beforeLoad: () => ({ breadcrumb: [{ label: "CMDB" }] }),
	head: () => ({ meta: [{ title: "Configuration item · Axiōma" }] }),
});
function CmdbObjectRoute() {
	const { objectId } = Route.useParams();
	const query = useQuery(
		orpc.getCmdbObject.queryOptions({ input: { id: objectId } }),
	);
	if (query.isPending && query.data == null) {
		return (
			<PageState
				kind="loading"
				title="Loading configuration item"
				description="Retrieving the recorded item…"
			/>
		);
	}
	if (query.isError && query.data == null) {
		return (
			<PageState
				kind="error"
				title="Configuration item unavailable"
				description={query.error.message}
				onRetry={() => query.refetch()}
			/>
		);
	}
	if (!query.data) {
		return (
			<PageState
				kind="empty"
				title="Configuration item not found"
				description="This item may have been removed or the ID is incorrect."
			/>
		);
	}
	return <CmdbObjectPage object={query.data} />;
}
