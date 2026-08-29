import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export type OverviewWidget = { key: string; title: string; width: 1 | 2 };

export function WidgetArrangement({
	widgets,
	onChange,
}: {
	widgets: readonly OverviewWidget[];
	onChange?: (widgets: readonly OverviewWidget[]) => void;
}) {
	const [ordered, setOrdered] = useState(widgets);
	useEffect(() => setOrdered(widgets), [widgets]);
	const move = (index: number, offset: -1 | 1) => {
		const next = [...ordered];
		const other = index + offset;
		if (!next[other]) return;
		[next[index], next[other]] = [next[other], next[index]];
		setOrdered(next);
		onChange?.(next);
	};
	return (
		<div className="grid gap-2">
			{ordered.map((widget, index) => (
				<div key={widget.key} className="flex items-center gap-2 border p-3">
					<span className="min-w-0 flex-1 font-medium">{widget.title}</span>
					<Button
						size="icon-sm"
						variant="outline"
						aria-label={`Move ${widget.title} up`}
						disabled={index === 0}
						onClick={() => move(index, -1)}
					>
						<ArrowUp />
					</Button>
					<Button
						size="icon-sm"
						variant="outline"
						aria-label={`Move ${widget.title} down`}
						disabled={index === ordered.length - 1}
						onClick={() => move(index, 1)}
					>
						<ArrowDown />
					</Button>
				</div>
			))}
		</div>
	);
}
