import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import type * as React from "react";

import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

function ToggleGroup({
	className,
	orientation = "horizontal",
	...props
}: ToggleGroupPrimitive.Props) {
	return (
		<ToggleGroupPrimitive
			data-slot="toggle-group"
			data-orientation={orientation}
			orientation={orientation}
			className={cn("inline-flex w-fit items-center gap-1", className)}
			{...props}
		/>
	);
}

function ToggleGroupItem({
	className,
	variant = "default",
	size = "default",
	...props
}: React.ComponentProps<typeof Toggle> & { value: string }) {
	return (
		<Toggle
			data-slot="toggle-group-item"
			variant={variant}
			size={size}
			className={className}
			{...props}
		/>
	);
}

export { ToggleGroup, ToggleGroupItem };
