import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageState } from "@/components/support-ui";
import { MailLogPage } from "@/features/mail/components";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/mail-log")({
	component: MailLogRoute,
	beforeLoad: () => ({ breadcrumb: "Mail send log" }),
	head: () => ({ meta: [{ title: "Mail send log · Axiōma" }] }),
});

function MailLogRoute() {
	const query = useQuery(
		orpc.listEmailSendLog.queryOptions({ input: { limit: 50 } }),
	);
	if (query.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading mail log"
				description="Retrieving delivery attempts…"
			/>
		);
	if (query.isError)
		return (
			<PageState
				kind="error"
				title="Mail log unavailable"
				description={query.error.message}
				onRetry={() => query.refetch()}
			/>
		);
	return <MailLogPage entries={query.data} />;
}
