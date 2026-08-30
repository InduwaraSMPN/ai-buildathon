import { RiAlarmWarningLine as AlertTriangle } from "@remixicon/react";
import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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

export function RouteError({
	error,
	reset,
}: {
	error: Error;
	reset: () => void;
}) {
	return (
		<main id="main-content" className="grid min-h-svh place-items-center p-6">
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
