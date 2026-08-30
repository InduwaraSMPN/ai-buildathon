import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ChangeEditor,
	ChangesPage,
} from "@/features/changes/components/changes";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/changes/")({
	component: ChangesRoute,
	beforeLoad: () => ({ breadcrumb: "Changes" }),
});
function ChangesRoute() {
	const client = useQueryClient();
	const query = useQuery(orpc.listChanges.queryOptions());
	const me = useQuery(orpc.privateData.queryOptions());
	const navigate = useNavigate();
	const create = useMutation(
		orpc.createChange.mutationOptions({
			onSuccess: async (change) => {
				await client.invalidateQueries({ queryKey: orpc.listChanges.key() });
				await navigate({
					to: "/changes/$changeId",
					params: { changeId: change.id },
				});
			},
		}),
	);
	return (
		<ChangesPage
			changes={query.data ?? []}
			action={
				<ChangeEditor
					pending={create.isPending}
					cabMemberId={me.data?.user?.id}
					onSubmit={(value) => create.mutate(value)}
				/>
			}
			onSelect={(change) =>
				void navigate({
					to: "/changes/$changeId",
					params: { changeId: change.id },
				})
			}
		/>
	);
}
