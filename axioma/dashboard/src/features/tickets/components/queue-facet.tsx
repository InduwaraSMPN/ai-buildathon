import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FacetValue = { value: string | null; label?: string; count: number };

export function QueueFacet({
	label,
	value = [],
	items,
	onChange,
}: {
	label: string;
	value?: (string | null)[];
	items: FacetValue[];
	onChange: (value?: (string | null)[]) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
				{value.length ? `${label} (${value.length})` : label}
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuGroup>
					{items.map((item) => (
						<DropdownMenuCheckboxItem
							key={item.value ?? "unclassified"}
							checked={value.includes(item.value)}
							onCheckedChange={(checked) => {
								const next = checked
									? [...value, item.value]
									: value.filter((current) => current !== item.value);
								onChange(next.length ? next : undefined);
							}}
						>
							<span className="capitalize">
								{item.label ??
									item.value?.replaceAll("_", " ") ??
									"Unclassified"}
							</span>
							<span className="ml-auto text-muted-foreground tabular-nums">
								{item.count}
							</span>
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
