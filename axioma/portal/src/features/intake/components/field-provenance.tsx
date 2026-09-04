import type { ReactNode } from "react";
import { AiLabel, AiRevert } from "@/components/ui/ai-label";
import { intakeCopy } from "@/features/intake/copy";

export function FieldProvenance({
	source,
	hasAiValue,
	onRevert,
	children,
}: {
	source: "ai" | "user" | null;
	hasAiValue: boolean;
	onRevert: () => void;
	children: ReactNode;
}) {
	if (source === "ai") {
		return (
			<div className="flex min-w-0 flex-col gap-1">
				<AiLabel>{intakeCopy.fieldFilledByAi}</AiLabel>
				{children}
			</div>
		);
	}
	if (source === "user" && hasAiValue) {
		return (
			<div className="flex min-w-0 flex-col gap-1">
				<AiRevert onClick={onRevert} className="justify-start self-start pl-0">
					{intakeCopy.revertToDraft}
				</AiRevert>
				{children}
			</div>
		);
	}
	return <>{children}</>;
}
