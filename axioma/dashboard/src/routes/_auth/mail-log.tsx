import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageState } from "@/components/support-ui";
import { MailLogPage } from "@/features/mail/components";
import { requireNav } from "@/lib/navigation";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/mail-log")({
	component: MailLogRoute,
	beforeLoad: ({ context }) => {
		requireNav("/mail-log", context);
		return { breadcrumb: "Mail send log" };
	},
	head: () => ({ meta: [{ title: "Mail send log · Axiōma" }] }),
});

function MailLogRoute() {
	const query = useQuery(
		orpc.listMailboxActivity.queryOptions({ input: { limit: 50 } }),
	);
	const sendQuery = useQuery(
		orpc.listEmailSendLog.queryOptions({ input: { limit: 50 } }),
	);
	if (query.isPending || sendQuery.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading mail log"
				description="Retrieving delivery attempts…"
			/>
		);
	if (query.isError || sendQuery.isError) {
		const failed = query.isError ? query : sendQuery;
		return (
			<PageState
				kind="error"
				title="Mail log unavailable"
				description={failed.error?.message ?? "Try again shortly."}
				onRetry={() => void failed.refetch()}
			/>
		);
	}
	return <MailLogPage entries={sendQuery.data} activity={query.data} />;
}
