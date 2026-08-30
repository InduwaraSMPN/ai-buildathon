import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
		<main className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
			{query.isPending ? (
				<div className="flex flex-col gap-4" role="status">
					<span className="flex items-center gap-2 text-muted-foreground text-sm">
						<Spinner aria-hidden="true" />
						{statusCopy.loading}
					</span>
					{[0, 1, 2].map((item) => (
						<Skeleton key={item} className="h-36 w-full" />
					))}
				</div>
			) : query.isError ? (
				<Alert variant="destructive">
					<AlertTitle>{statusCopy.unavailable}</AlertTitle>
					<AlertDescription>
						{statusCopy.unavailableDescription}
					</AlertDescription>
					<Button
						type="button"
						variant="outline"
						className="mt-3 w-fit"
						onClick={() => query.refetch()}
					>
						Try again
					</Button>
				</Alert>
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
