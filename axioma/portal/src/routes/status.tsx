import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ServiceStatusList } from "@/features/status/components/service-status";
import { statusCopy } from "@/features/status/copy";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/status")({
	component: PublicStatusPage,
	head: () => ({ meta: [{ title: statusCopy.title }] }),
});

function PublicStatusPage() {
	const query = useQuery(orpc.readStatus.queryOptions({ input: { days: 90 } }));
	return (
		<main className="mx-auto min-h-full w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
			{query.isPending ? (
				<p
					role="status"
					className="rounded-xl border p-8 text-center text-muted-foreground"
				>
					{statusCopy.loading}
				</p>
			) : query.isError ? (
				<div role="alert" className="rounded-xl border p-8 text-center">
					<p className="font-medium">{statusCopy.unavailable}</p>
					<p className="mt-1 text-muted-foreground text-sm">
						{statusCopy.unavailableDescription}
					</p>
					<button
						type="button"
						className="mt-3 underline underline-offset-4"
						onClick={() => query.refetch()}
					>
						Try again
					</button>
				</div>
			) : (
				<ServiceStatusList services={query.data} />
			)}
			<Link
				to="/login"
				className="text-muted-foreground text-sm underline underline-offset-4"
			>
				{statusCopy.backToSignIn}
			</Link>
		</main>
	);
}
