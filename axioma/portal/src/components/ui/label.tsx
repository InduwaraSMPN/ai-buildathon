// GENERATED — do not edit.
// Mirrored from axioma/ui/src by `pnpm --dir axioma/ui mirror`.
// Change the source in axioma/ui and re-run that command.

import type * as React from "react";

import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
	return (
		// Consumers associate this primitive through htmlFor or nested controls.
		// biome-ignore lint/a11y/noLabelWithoutControl: Association is supplied through the forwarded props and children.
		<label
			data-slot="label"
			className={cn(
				"flex select-none items-center gap-2 font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
