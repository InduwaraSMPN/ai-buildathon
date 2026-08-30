import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import {
	type OverviewWidget,
	WidgetArrangement,
} from "@/features/automation/components";
import { orpc } from "@/utils/orpc";

const available = [
	{ key: "priority", title: "Open by priority", width: 2 },
	{ key: "confirmation", title: "Awaiting confirmation", width: 1 },
	{ key: "escalations", title: "Escalated in 24 hours", width: 1 },
	{ key: "resolution-rate", title: "Autonomous resolution rate", width: 1 },
	{ key: "median-ttr", title: "Median time to resolution", width: 1 },
] satisfies OverviewWidget[];

export const Route = createFileRoute("/_auth/overview-widgets")({
	component: OverviewWidgetsRoute,
	beforeLoad: () => ({ breadcrumb: "Overview widgets" }),
	head: () => ({ meta: [{ title: "Overview widgets · Axiōma" }] }),
});

function OverviewWidgetsRoute() {
	const queryClient = useQueryClient();
	const query = useQuery(orpc.getDashboardArrangement.queryOptions());
	const latestMutation = useRef(0);
	const arrangementQuery = { queryKey: orpc.getDashboardArrangement.key() };
	const save = useMutation(
		orpc.setDashboardArrangement.mutationOptions({
			scope: { id: "dashboard-arrangement" },
			onMutate: async ({ widgets }) => {
				const mutationId = ++latestMutation.current;
				await queryClient.cancelQueries(arrangementQuery);
				queryClient.setQueryData(
					arrangementQuery.queryKey,
					widgets.map((widget, position) => ({ ...widget, position })),
				);
				return { mutationId };
			},
			onSuccess: (arrangement, _variables, context) => {
				if (context?.mutationId !== latestMutation.current) return;
				queryClient.setQueryData(arrangementQuery.queryKey, arrangement);
				toast.success("Widget arrangement saved");
			},
			onError: async (error, _variables, context) => {
				if (context?.mutationId !== latestMutation.current) return;
				await queryClient.invalidateQueries(arrangementQuery);
				toast.error(error.message);
			},
		}),
	);
	if (query.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading widgets"
				description="Retrieving your arrangement…"
			/>
		);
	if (query.isError)
		return (
			<PageState
				kind="error"
				title="Widgets unavailable"
				description={query.error.message}
				onRetry={() => query.refetch()}
			/>
		);
	const widgets = query.data.length
		? query.data.map((saved) => ({
				key: saved.widgetKey,
				title:
					available.find((item) => item.key === saved.widgetKey)?.title ??
					saved.widgetKey,
				width: saved.width,
			}))
		: available;
	return (
		<PageContainer
			title="Overview widgets"
			description="Arrange the widgets shown on your overview."
		>
			<WidgetArrangement
				widgets={widgets}
				onChange={(next) =>
					save.mutate({
						widgets: next.map(({ key, width }) => ({ widgetKey: key, width })),
					})
				}
			/>
		</PageContainer>
	);
}
