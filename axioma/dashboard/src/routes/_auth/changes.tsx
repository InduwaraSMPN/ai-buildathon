import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChangesPage } from "@/features/changes/components/changes";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/changes")({
	component: ChangesRoute,
	beforeLoad: () => ({ breadcrumb: "Changes" }),
});
function ChangesRoute() {
	const query = useQuery(orpc.listChanges.queryOptions());
	const navigate = useNavigate();
	return (
		<ChangesPage
			changes={query.data ?? []}
			onSelect={(change) =>
				void navigate({
					to: "/changes/$changeId",
					params: { changeId: change.id },
				})
			}
		/>
	);
}
