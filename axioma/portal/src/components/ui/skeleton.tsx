// GENERATED — do not edit.
// Mirrored from axioma/ui/src by `pnpm --dir axioma/ui mirror`.
// Change the source in axioma/ui and re-run that command.

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="skeleton"
			className={cn("animate-pulse rounded-md bg-muted", className)}
			{...props}
		/>
	);
}

export { Skeleton };
