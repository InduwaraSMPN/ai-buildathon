import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RoutePending() {
	return (
		<div className="grid min-h-48 place-items-center" role="status">
			<span className="flex items-center gap-2 text-muted-foreground">
				<Loader2 className="size-4 animate-spin" />
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
			<div className="max-w-md text-center">
				<AlertTriangle className="mx-auto mb-3 text-destructive" />
				<h1 className="font-semibold">Something went wrong</h1>
				<p className="my-3 text-muted-foreground text-sm">{error.message}</p>
				<Button onClick={reset}>Try again</Button>
			</div>
		</main>
	);
}
