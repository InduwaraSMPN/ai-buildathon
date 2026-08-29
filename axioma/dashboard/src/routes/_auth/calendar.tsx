import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageState } from "@/components/support-ui";
import { CalendarPage } from "@/features/scheduling/components";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/calendar")({
	component: CalendarRoute,
	beforeLoad: () => ({ breadcrumb: "Scheduled work" }),
	head: () => ({ meta: [{ title: "Scheduled work · Axiōma" }] }),
});

function CalendarRoute() {
	const from = new Date();
	const to = new Date(from.getTime() + 90 * 86_400_000);
	const query = useQuery(
		orpc.listCalendar.queryOptions({ input: { from, to } }),
	);
	if (query.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading calendar"
				description="Retrieving scheduled work…"
			/>
		);
	if (query.isError)
		return (
			<PageState
				kind="error"
				title="Calendar unavailable"
				description={query.error.message}
				onRetry={() => query.refetch()}
			/>
		);
	return <CalendarPage work={query.data} />;
}
