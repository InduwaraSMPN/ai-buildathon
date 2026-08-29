import { Button } from "@/components/ui/button";
import type { TicketQueueSearch } from "./queue-search";

export const SAVED_VIEWS = [
	{
		label: "My escalations",
		search: { status: ["escalated"], route: ["human_triage"] },
	},
	{
		label: "P1 and P2 open",
		search: { status: ["open"], priority: ["P1", "P2"] },
	},
	{ label: "Awaiting confirmation", search: { status: ["resolved"] } },
	{ label: "Unassigned", search: { unassigned: true } },
] as const satisfies ReadonlyArray<{
	label: string;
	search: TicketQueueSearch;
}>;

const same = (left: unknown, right: unknown) =>
	Array.isArray(left) && Array.isArray(right)
		? left.length === right.length &&
			left.every((value) => right.includes(value))
		: left === right;

export function SavedViews({
	active,
	onSelect,
}: {
	active: TicketQueueSearch;
	onSelect: (search: TicketQueueSearch) => void;
}) {
	return (
		<nav aria-label="Saved queue views" className="flex flex-wrap gap-1.5">
			{SAVED_VIEWS.map((view) => {
				const selected = Object.entries(view.search).every(([key, value]) =>
					same(active[key as keyof TicketQueueSearch], value),
				);
				return (
					<Button
						key={view.label}
						variant={selected ? "secondary" : "ghost"}
						size="sm"
						onClick={() => onSelect(view.search)}
					>
						{view.label}
					</Button>
				);
			})}
		</nav>
	);
}
