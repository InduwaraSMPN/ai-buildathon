import { useQuery } from "@tanstack/react-query";
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { PageState, timeAgo } from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deviceQueries } from "../api/queries";
import type { Device } from "../api/types";

const column = createColumnHelper<Device>();
const columns = [
	column.accessor("connected", {
		header: "Connection",
		cell: ({ getValue }) => {
			const status = getValue();
			const online = status.toLowerCase() === "online";
			return (
				<span
					className={
						online
							? "inline-flex rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-medium text-[10px] text-emerald-700 uppercase tracking-wider dark:text-emerald-300"
							: "inline-flex rounded-md border border-border bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider"
					}
				>
					{status}
				</span>
			);
		},
	}),
	column.accessor("hostname", { header: "Hostname" }),
	column.accessor(
		(device) => device.ownerName ?? device.username ?? "Unassigned",
		{
			id: "user",
			header: "User",
			cell: ({ row }) => (
				<div>
					<p>{row.original.ownerName ?? "Unassigned"}</p>
					<p className="text-[10px] text-muted-foreground">
						{row.original.username ?? "No local user"}
					</p>
				</div>
			),
		},
	),
	column.accessor("lastSeenAt", {
		header: "Last seen",
		cell: ({ getValue }) => {
			const value = getValue();
			return <span title={value.toLocaleString()}>{timeAgo(value)}</span>;
		},
		sortingFn: "datetime",
	}),
];

export function DevicesTable() {
	const query = useQuery(deviceQueries.all());
	const [filter, setFilter] = useState("");
	const [sorting, setSorting] = useState<SortingState>([]);
	const table = useReactTable({
		data: query.data ?? [],
		columns,
		state: { globalFilter: filter, sorting },
		onGlobalFilterChange: setFilter,
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	});

	if (query.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading devices"
				description="Reading endpoint connection state…"
			/>
		);
	if (query.isError)
		return (
			<PageState
				kind="error"
				title="Devices unavailable"
				description={query.error.message}
				onRetry={() => query.refetch()}
			/>
		);

	return (
		<div className="space-y-3">
			<label className="block max-w-sm" htmlFor="devices-filter">
				<span className="sr-only">Filter devices</span>
				<Input
					id="devices-filter"
					value={filter}
					onChange={(event) => setFilter(event.target.value)}
					placeholder="Filter connection, hostname, or user…"
				/>
			</label>
			{table.getRowModel().rows.length === 0 ? (
				<PageState
					kind="empty"
					title="No devices found"
					description={
						filter
							? "No device matches this filter."
							: "No devices are enrolled."
					}
				/>
			) : (
				<div className="overflow-x-auto border bg-card">
					<table className="w-full min-w-[680px] text-left text-xs">
						<thead className="bg-muted/60 text-[10px] text-muted-foreground uppercase tracking-wider">
							{table.getHeaderGroups().map((group) => (
								<tr key={group.id}>
									{group.headers.map((header) => (
										<th key={header.id} className="px-3 py-2 font-medium">
											{header.isPlaceholder ? null : (
												<Button
													variant="ghost"
													size="xs"
													onClick={header.column.getToggleSortingHandler()}
												>
													{flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
													<ArrowUpDown aria-hidden="true" />
												</Button>
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
										<td key={cell.id} className="px-3 py-3">
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
			<div className="flex items-center justify-between text-muted-foreground text-xs">
				<span>
					Page {table.getState().pagination.pageIndex + 1} of{" "}
					{table.getPageCount() || 1}
				</span>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						Next
					</Button>
				</div>
			</div>
		</div>
	);
}
