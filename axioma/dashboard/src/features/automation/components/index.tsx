import { RiArrowDownLine, RiArrowUpLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemGroup,
	ItemTitle,
} from "@/components/ui/item";

export type OverviewWidget = { key: string; title: string; width: 1 | 2 };

export function WidgetArrangement({
	widgets,
	onChange,
}: {
	widgets: readonly OverviewWidget[];
	onChange?: (widgets: readonly OverviewWidget[]) => void;
}) {
	const move = (index: number, offset: -1 | 1) => {
		const next = [...widgets];
		const other = index + offset;
		if (!next[other]) return;
		[next[index], next[other]] = [next[other], next[index]];
		onChange?.(next);
	};
	return (
		<ItemGroup className="gap-2">
			{widgets.map((widget, index) => (
				<Item key={widget.key} variant="outline">
					<ItemContent>
						<ItemTitle>{widget.title}</ItemTitle>
					</ItemContent>
					<ItemActions>
						<Button
							size="icon-sm"
							variant="outline"
							aria-label={`Move ${widget.title} up`}
							disabled={index === 0}
							onClick={() => move(index, -1)}
						>
							<RiArrowUpLine />
						</Button>
						<Button
							size="icon-sm"
							variant="outline"
							aria-label={`Move ${widget.title} down`}
							disabled={index === widgets.length - 1}
							onClick={() => move(index, 1)}
						>
							<RiArrowDownLine />
						</Button>
					</ItemActions>
				</Item>
			))}
		</ItemGroup>
	);
}
