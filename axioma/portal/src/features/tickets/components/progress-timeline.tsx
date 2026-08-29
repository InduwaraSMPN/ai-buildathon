import { Check, Circle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
	getProgressMarkerCopy,
	statusDetailCopy,
	ticketStages,
	timelineCopy,
} from "@/features/tickets/copy";
import { cn } from "@/lib/utils";

const stageIndex: Record<string, number> = {
	new: 0,
	open: 1,
	pending: 1,
	resolved: 2,
	closed: 2,
};

export function ProgressTimeline({
	stateType,
	progressMarker,
}: {
	stateType: string;
	progressMarker: string | null;
}) {
	const current = stageIndex[stateType] ?? 0;
	const marker = getProgressMarkerCopy(progressMarker);
	const detail = statusDetailCopy[stateType];

	return (
		<section
			aria-labelledby="request-progress-heading"
			aria-live="polite"
			aria-atomic="true"
		>
			<h2
				id="request-progress-heading"
				className="mb-4 font-semibold text-base"
			>
				{timelineCopy.heading}
			</h2>
			<ol className="grid grid-cols-1 gap-0 sm:grid-cols-4">
				{ticketStages.map((stage, index) => {
					const complete = index < current || (current === 2 && index === 2);
					const active = index === current && !complete;
					return (
						<li
							key={stage}
							className="relative flex min-w-0 gap-3 pb-5 last:pb-0 sm:block sm:pb-0"
						>
							{index < ticketStages.length - 1 ? (
								<span
									aria-hidden="true"
									className={cn(
										"absolute top-7 bottom-0 left-3.5 w-px bg-border sm:top-3.5 sm:right-0 sm:bottom-auto sm:left-7 sm:h-px sm:w-auto",
										index < current && "bg-primary",
									)}
								/>
							) : null}
							<span
								className={cn(
									"relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background",
									(complete || active) && "border-primary text-primary",
								)}
							>
								{complete ? (
									<Check className="size-4" aria-hidden="true" />
								) : active ? (
									<Spinner className="size-4" aria-hidden="true" />
								) : (
									<Circle className="size-3" aria-hidden="true" />
								)}
								<span className="sr-only">
									{complete
										? timelineCopy.complete
										: active
											? timelineCopy.current
											: timelineCopy.upcoming}
								</span>
							</span>
							<p className="pt-1 font-medium text-sm sm:mt-2 sm:pt-0 sm:pr-3">
								{stage}
							</p>
						</li>
					);
				})}
			</ol>
			{detail ? (
				<p className="mt-5 text-muted-foreground text-sm">{detail}</p>
			) : null}
			{marker ? <p className="mt-2 font-medium text-sm">{marker}</p> : null}
		</section>
	);
}
