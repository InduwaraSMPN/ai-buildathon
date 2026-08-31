import { RiArrowUpDownLine as ArrowUpDown } from "@remixicon/react";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { useId, useState } from "react";
import { PageState } from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export function DataTable<TRow>({
	data,
	columns,
	filterPlaceholder,
	filterLabel,
	emptyTitle,
	emptyDescription,
	pageSize = 10,
	onRowClick,
	rowLabel,
}: {
	data: readonly TRow[];
	// biome-ignore lint/suspicious/noExplicitAny: column defs are heterogeneous by design; TRow still pins the row type.
	columns: ColumnDef<TRow, any>[];
	filterPlaceholder: string;
	filterLabel: string;
	emptyTitle: string;
	emptyDescription: string;
	pageSize?: number;
	onRowClick?: (row: TRow) => void;
	rowLabel?: (row: TRow) => string;
}) {
	const filterId = useId();
	const [filter, setFilter] = useState("");
	const [sorting, setSorting] = useState<SortingState>([]);
	const table = useReactTable({
		data: data as TRow[],
		columns,
		state: { globalFilter: filter, sorting },
		onGlobalFilterChange: setFilter,
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: { pagination: { pageSize } },
	});
	const rows = table.getRowModel().rows;

	return (
		<div className="flex flex-col gap-3">
			<label className="block max-w-sm" htmlFor={filterId}>
				<span className="sr-only">{filterLabel}</span>
				<Input
					id={filterId}
					value={filter}
					onChange={(event) => setFilter(event.target.value)}
					placeholder={filterPlaceholder}
				/>
			</label>
			{rows.length === 0 ? (
				<PageState
					kind="empty"
					title={emptyTitle}
					description={
						filter ? "Nothing matches this filter." : emptyDescription
					}
				/>
			) : (
				<Card>
					<CardContent className="px-0">
						<Table className="table-fixed [&_td]:whitespace-normal [&_td]:break-words [&_td]:align-top [&_th]:whitespace-normal">
							<TableHeader>
								{table.getHeaderGroups().map((group) => (
									<TableRow key={group.id}>
										{group.headers.map((header) => (
											<TableHead
												key={header.id}
												style={{
													width: header.column.columnDef.size
														? `${header.column.columnDef.size}%`
														: undefined,
												}}
											>
												{header.isPlaceholder ? null : header.column.getCanSort() ? (
													<Button
														variant="ghost"
														size="xs"
														className="h-auto min-w-0 whitespace-normal py-1 text-left"
														onClick={header.column.getToggleSortingHandler()}
													>
														{flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
														<ArrowUpDown aria-hidden="true" />
													</Button>
												) : (
													flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)
												)}
											</TableHead>
										))}
									</TableRow>
								))}
							</TableHeader>
							<TableBody>
								{rows.map((row) => (
									<TableRow
										key={row.id}
										tabIndex={onRowClick ? 0 : undefined}
										className={
											onRowClick
												? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
												: undefined
										}
										onClick={() => onRowClick?.(row.original)}
										onKeyDown={(event) => {
											if (
												onRowClick &&
												(event.key === "Enter" || event.key === " ")
											) {
												event.preventDefault();
												onRowClick(row.original);
											}
										}}
										aria-label={
											onRowClick ? rowLabel?.(row.original) : undefined
										}
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id}>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
			{table.getPageCount() > 1 ? (
				<div className="flex items-center justify-between text-muted-foreground text-xs">
					<span className="tabular-nums">
						Page {table.getState().pagination.pageIndex + 1} of{" "}
						{table.getPageCount()}
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
			) : null}
		</div>
	);
}
