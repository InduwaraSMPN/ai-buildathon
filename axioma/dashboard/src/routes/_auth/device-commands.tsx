import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageState } from "@/components/support-ui";
import { DeviceProposalsPage } from "@/features/device-proposals/components/device-proposals";
import { requireNav } from "@/lib/navigation";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/device-commands")({
	component: DeviceProposalsRoute,
	beforeLoad: ({ context }) => {
		requireNav("/device-commands", context);
		return { breadcrumb: "Device commands" };
	},
	head: () => ({ meta: [{ title: "Device commands · Axiōma" }] }),
});

function DeviceProposalsRoute() {
	const client = useQueryClient();
	const query = useQuery(orpc.listDeviceProposals.queryOptions());
	const decide = useMutation(
		orpc.decideDeviceProposal.mutationOptions({
			onSuccess: () =>
				client.invalidateQueries({ queryKey: orpc.listDeviceProposals.key() }),
		}),
	);
	if (query.isPending && query.data == null) {
		return (
			<PageState
				kind="loading"
				title="Loading device commands"
				description="Retrieving proposed commands…"
			/>
		);
	}
	if (query.isError && query.data == null) {
		return (
			<PageState
				kind="error"
				title="Device commands unavailable"
				description={query.error.message}
				onRetry={() => query.refetch()}
			/>
		);
	}
	return (
		<DeviceProposalsPage
			proposals={query.data ?? []}
			pendingId={decide.variables?.id}
			onDecide={(proposal, decision) =>
				decide.mutate({ id: proposal.id, decision })
			}
		/>
	);
}
