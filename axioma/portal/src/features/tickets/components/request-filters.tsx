import { RiCloseLine, RiSearchLine } from "@remixicon/react";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type RequestFilter =
	| "All requests"
	| "In progress"
	| "Needs you"
	| "Finished";

export function RequestFilters({
	query,
	filter,
	resultCount,
	onQueryChange,
	onFilterChange,
	className,
}: {
	query: string;
	filter: RequestFilter;
	resultCount: number;
	onQueryChange: (query: string) => void;
	onFilterChange: (filter: RequestFilter) => void;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-3 sm:flex-row sm:items-center",
				className,
			)}
		>
			<InputGroup className="h-10 flex-1">
				<InputGroupAddon>
					<RiSearchLine aria-hidden="true" />
				</InputGroupAddon>
				<InputGroupInput
					type="search"
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					placeholder="Search requests"
					aria-label="Search requests"
				/>
				{query ? (
					<InputGroupAddon align="inline-end">
						<InputGroupButton
							size="icon-xs"
							onClick={() => onQueryChange("")}
							aria-label="Clear search"
						>
							<RiCloseLine aria-hidden="true" />
						</InputGroupButton>
					</InputGroupAddon>
				) : null}
			</InputGroup>
			<Select
				value={filter}
				onValueChange={(value) =>
					onFilterChange((value ?? "All requests") as RequestFilter)
				}
			>
				<SelectTrigger
					className="h-10 w-full data-[size=default]:h-10 sm:w-48"
					aria-label="Filter requests"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectItem value="All requests">All requests</SelectItem>
						<SelectItem value="In progress">In progress</SelectItem>
						<SelectItem value="Needs you">Needs you</SelectItem>
						<SelectItem value="Finished">Finished</SelectItem>
					</SelectGroup>
				</SelectContent>
			</Select>
			<p className="sr-only" aria-live="polite">
				{resultCount} matching requests
			</p>
		</div>
	);
}
