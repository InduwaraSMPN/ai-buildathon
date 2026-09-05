import { getStageIndex, ticketStages } from "@/features/tickets/copy";
import { cn } from "@/lib/utils";

export function StageBar({ stateType }: { stateType: string }) {
	const current = getStageIndex(stateType);
	return (
		<div
			className="flex flex-col gap-1.5"
			role="img"
			aria-label={`Progress: ${ticketStages[current]}`}
		>
			<div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
				{ticketStages.map((stage, index) => (
					<span
						key={stage}
						className={cn(
							"h-6 rounded-lg border bg-[repeating-linear-gradient(135deg,var(--border)_0_1.5px,transparent_1.5px_7px)]",
							(index < current || current === 2) && "border-primary bg-primary",
							index === current &&
								current < 2 &&
								"border-primary/60 bg-[linear-gradient(90deg,var(--primary)_0_55%,transparent_55%),repeating-linear-gradient(135deg,var(--border)_0_1.5px,transparent_1.5px_7px)]",
						)}
					/>
				))}
			</div>
			<div
				className="grid grid-cols-3 gap-1.5 text-muted-foreground text-xs"
				aria-hidden="true"
			>
				{ticketStages.map((stage, index) => (
					<span
						key={stage}
						className={cn(index === current && "font-medium text-foreground")}
					>
						{stage}
					</span>
				))}
			</div>
		</div>
	);
}
