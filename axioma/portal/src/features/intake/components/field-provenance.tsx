import type { ReactNode } from "react";
import { intakeCopy } from "@/features/intake/copy";

/**
 * Where a field's value came from, said once and quietly.
 *
 * Every AI-filled field used to carry a full "Filled by AI" pill, so a drafted
 * form showed the same blue badge eight times over and the two fields the
 * employee actually had to touch were the least conspicuous things on it. The
 * banner above the form says the whole form was drafted, so an AI-filled field
 * keeps only a screen-reader name; the exceptions — a field the assistant left
 * for the employee, and one they have changed — are the only ones that spend a
 * visible line.
 */
export function FieldProvenance({
	source,
	hasAiValue,
	needsInput = false,
	onRevert,
	children,
}: {
	source: "ai" | "user" | null;
	hasAiValue: boolean;
	/** The assistant left this blank or was unsure; the banner counts it. */
	needsInput?: boolean;
	onRevert: () => void;
	children: ReactNode;
}) {
	const edited = source === "user" && hasAiValue;
	if (!needsInput && !edited && source !== "ai") return <>{children}</>;

	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			{needsInput ? (
				<p className="flex items-center gap-1.5 font-medium text-warning text-xs">
					<span
						className="size-1.5 rounded-full bg-warning"
						aria-hidden="true"
					/>
					{intakeCopy.fieldNeedsInput}
				</p>
			) : edited ? (
				<p className="flex items-center gap-2 text-muted-foreground text-xs">
					{intakeCopy.fieldEdited}
					<button
						type="button"
						className="text-info underline underline-offset-4 hover:text-foreground"
						onClick={onRevert}
					>
						{intakeCopy.revertToDraft}
					</button>
				</p>
			) : (
				// The banner already says the form was drafted, so a filled field
				// spends nothing visible — only a name for anyone who cannot see it.
				<span className="sr-only">{intakeCopy.fieldFilledByAi}</span>
			)}
			{children}
		</div>
	);
}
