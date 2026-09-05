import { RiAlarmWarningLine as AlertTriangle } from "@remixicon/react";
import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export function RoutePending() {
	return (
		<div className="grid min-h-48 place-items-center" role="status">
			<span className="flex items-center gap-2 text-muted-foreground">
				<Spinner />
				Loading…
			</span>
		</div>
	);
}

/**
 * Pending state for the authed shell.
 *
 * The gate at _auth awaits a session and then privateData — two sequential
 * round-trips — and until they land the real sidebar and header cannot render,
 * because both read `capabilities` off a route context that does not exist yet.
 * So this reserves the same geometry with skeletons instead of collapsing to a
 * bare spinner and making the whole application disappear between navigations.
 */
export function AuthPending() {
	return (
		<div className="flex min-h-svh">
			<div
				className="hidden w-64 shrink-0 flex-col gap-2 border-r bg-sidebar p-4 md:flex"
				aria-hidden="true"
			>
				<Skeleton className="h-7 w-32" />
				<Skeleton className="mt-4 h-4 w-20" />
				{[0, 1, 2, 3, 4, 5].map((row) => (
					<Skeleton key={row} className="h-8 w-full" />
				))}
			</div>
			<div className="flex min-w-0 flex-1 flex-col">
				<div
					className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4"
					aria-hidden="true"
				>
					<Skeleton className="h-4 w-40" />
					<Skeleton className="h-8 w-52" />
				</div>
				<main
					id="main-content"
					className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6"
					tabIndex={-1}
					role="status"
					aria-label="Loading"
				>
					<Skeleton className="h-8 w-56" />
					<Skeleton className="h-4 w-80" />
					<Skeleton className="mt-2 h-64 w-full" />
				</main>
			</div>
		</div>
	);
}

export function RouteError({
	error,
	reset,
}: {
	error: Error;
	reset: () => void;
}) {
	return (
		<main
			id="main-content"
			className="grid flex-1 place-items-center p-6"
			tabIndex={-1}
		>
			<Alert variant="destructive" className="max-w-md">
				<AlertTriangle />
				<AlertTitle>Something went wrong</AlertTitle>
				<AlertDescription>{error.message}</AlertDescription>
				<AlertAction>
					<Button variant="outline" size="sm" onClick={reset}>
						Try again
					</Button>
				</AlertAction>
			</Alert>
		</main>
	);
}
