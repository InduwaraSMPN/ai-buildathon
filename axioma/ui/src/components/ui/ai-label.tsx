import { RiSparkling2Line } from "@remixicon/react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function AiLabel({
	className,
	children,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="ai-label"
			className={cn(
				"inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full border border-info/30 bg-info/10 px-1.5 font-medium text-info text-xs",
				className,
			)}
			{...props}
		>
			<RiSparkling2Line className="size-3" />
			{children ?? "AI"}
		</span>
	);
}

function AiRevert({
	className,
	children,
	...props
}: React.ComponentProps<typeof Button>) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="xs"
			data-slot="ai-revert"
			className={cn("text-info hover:text-info", className)}
			{...props}
		>
			{children ?? "Revert to draft"}
		</Button>
	);
}

export { AiLabel, AiRevert };
