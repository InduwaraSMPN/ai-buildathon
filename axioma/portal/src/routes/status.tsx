import { RiArrowLeftLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import Header from "@/components/header";
import { PageHeading, PageShell } from "@/components/ticket-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
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
		<div className="grid min-h-full grid-rows-[auto_1fr]">
			<Header />
			<PageShell>
				<Link
					to="/login"
					className={buttonVariants({
						variant: "ghost",
						size: "sm",
						className: "mb-6 -ml-2",
					})}
				>
					<RiArrowLeftLine data-icon="inline-start" aria-hidden="true" />
					{statusCopy.backToSignIn}
				</Link>
				<PageHeading
					eyebrow={statusCopy.eyebrow}
					title={statusCopy.title}
					description={statusCopy.summary}
				/>
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
			</PageShell>
		</div>
	);
}
