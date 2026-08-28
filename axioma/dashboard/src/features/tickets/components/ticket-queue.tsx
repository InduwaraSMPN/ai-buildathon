import { Link } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageState, StatusBadge, timeAgo } from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { Ticket } from "../api/types";

const columns: ColumnDef<Ticket>[] = [
	{
		accessorKey: "title",
		header: ({ column }) => <SortButton label="Ticket" column={column} />,
		cell: ({ row }) => (
			<div className="max-w-md">
				<Link
					to="/tickets/$ticketId"
					params={{ ticketId: row.original.id }}
					className="font-medium hover:underline"
				>
					{row.original.title}
				</Link>
				<div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
					{row.original.id}
				</div>
			</div>
		),
	},
	{
		accessorKey: "status",
		header: ({ column }) => <SortButton label="Status" column={column} />,
		cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
	},
	{
		accessorKey: "reporterName",
		header: ({ column }) => <SortButton label="Reporter" column={column} />,
	},
	{
		accessorKey: "route",
		header: "Route",
		cell: ({ getValue }) => getValue<string | null>() ?? "Unassigned",
	},
	{
		accessorKey: "updatedAt",
		header: ({ column }) => <SortButton label="Updated" column={column} />,
		cell: ({ getValue }) => {
			const date = getValue<Date>();
			return <span title={date.toLocaleString()}>{timeAgo(date)}</span>;
		},
	},
];

function SortButton({
	label,
	column,
}: {
	label: string;
	column: {
		toggleSorting: (desc?: boolean) => void;
		getIsSorted: () => false | "asc" | "desc";
	};
}) {
	return (
		<Button
			variant="ghost"
			size="sm"
			className="-ml-3 h-7"
			onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
		>
			{label} <ArrowUpDown className="size-3" />
		</Button>
	);
}

export function TicketQueue({
	tickets,
	isPending = false,
	error,
	onRetry,
}: {
	tickets: Ticket[];
	isPending?: boolean;
	error?: Error | null;
	onRetry?: () => void;
}) {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "updatedAt", desc: true },
	]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const table = useReactTable({
		data: tickets,
		columns: useMemo(() => columns, []),
		state: { sorting, globalFilter, columnVisibility },
		onSortingChange: setSorting,
		onGlobalFilterChange: setGlobalFilter,
		onColumnVisibilityChange: setColumnVisibility,
		globalFilterFn: (row, _columnId, value) =>
			`${row.original.id} ${row.original.title} ${row.original.reporterName} ${row.original.status} ${row.original.route ?? ""}`
				.toLowerCase()
				.includes(String(value).trim().toLowerCase()),
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	});

	return (
		<section
			className="overflow-hidden rounded-xl border bg-card shadow-xs"
			aria-labelledby="ticket-queue-heading"
		>
			<div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 id="ticket-queue-heading" className="font-semibold">
						Ticket queue
					</h2>
					<p className="text-muted-foreground text-xs">
						Triage, route, and resolve employee requests.
					</p>
				</div>
				<div className="flex gap-2">
					<label
						className="relative block min-w-0 flex-1 sm:w-72"
						htmlFor="ticket-filter"
					>
						<span className="sr-only">Search tickets</span>
						<Search className="absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
						<Input
							id="ticket-filter"
							value={globalFilter}
							onChange={(event) => setGlobalFilter(event.target.value)}
							placeholder="Search tickets…"
							className="pl-8"
						/>
					</label>
					<DropdownMenu>
						<DropdownMenuTrigger render={<Button variant="outline" />}>
							Columns <ChevronDown className="size-3.5" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{table.getAllLeafColumns().map((column) => (
								<DropdownMenuCheckboxItem
									key={column.id}
									checked={column.getIsVisible()}
									onCheckedChange={(checked) =>
										column.toggleVisibility(checked)
									}
								>
									<span className="capitalize">
										{column.id.replace(/([A-Z])/g, " $1")}
									</span>
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{isPending ? (
				<PageState
					kind="loading"
					title="Loading queue"
					description="Fetching the latest support tickets…"
				/>
			) : error ? (
				<PageState
					kind="error"
					title="Queue unavailable"
					description={error.message}
					onRetry={onRetry}
				/>
			) : table.getRowModel().rows.length === 0 ? (
				<PageState
					kind="empty"
					title="No matching tickets"
					description="Change the search filter to widen the queue."
				/>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full min-w-[760px] border-collapse text-left text-xs">
						<thead className="bg-muted/40 text-muted-foreground">
							{table.getHeaderGroups().map((group) => (
								<tr key={group.id}>
									{group.headers.map((header) => (
										<th key={header.id} className="px-4 py-2.5 font-medium">
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody>
							{table.getRowModel().rows.map((row) => (
								<tr key={row.id} className="border-t hover:bg-muted/40">
									{row.getVisibleCells().map((cell) => (
										<td
											key={cell.id}
											className="px-4 py-3 text-muted-foreground first:text-foreground"
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-xs">
				<span className="text-muted-foreground">
					{table.getFilteredRowModel().rows.length} of {tickets.length} tickets
				</span>
				<div className="flex items-center gap-2">
					<span className="text-muted-foreground">
						Page {table.getState().pagination.pageIndex + 1} of{" "}
						{table.getPageCount() || 1}
					</span>
					<Button
						variant="outline"
						size="sm"
						disabled={!table.getCanPreviousPage()}
						onClick={() => table.previousPage()}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!table.getCanNextPage()}
						onClick={() => table.nextPage()}
					>
						Next
					</Button>
				</div>
			</div>
		</section>
	);
}
