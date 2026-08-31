// GENERATED — do not edit.
// Mirrored from axioma/ui/src by `pnpm --dir axioma/ui mirror`.
// Change the source in axioma/ui and re-run that command.

import { RiLoaderLine } from "@remixicon/react";
import { cn } from "@/lib/utils";

type SpinnerProps = React.ComponentProps<typeof RiLoaderLine>;

function Spinner({ className, ...props }: SpinnerProps) {
	return (
		<RiLoaderLine
			data-slot="spinner"
			role="status"
			aria-label="Loading"
			className={cn("size-4 animate-spin", className)}
			{...props}
		/>
	);
}

export { Spinner };
