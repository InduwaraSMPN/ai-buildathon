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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";
import type { Device } from "../api/types";
import { DeviceDetailSheet } from "./device-detail-sheet";

const column = createColumnHelper<Device>();
const columns = [
	column.accessor("hostname", {
		header: "Device",
		cell: ({ row }) => {
			const online = Date.now() - row.original.lastSeenAt.getTime() <= 30_000;
			return (
				<div>
					<p className="flex items-center gap-2 font-medium">
						<span
							className={`size-2 rounded-full ${online ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
							aria-hidden="true"
						/>
						{row.original.hostname}
						<span className="sr-only">{online ? "Online" : "Offline"}</span>
					</p>
					<p className="font-mono text-[10px] text-muted-foreground">
						{row.original.id}
					</p>
				</div>
			);
		},
	}),
	column.accessor(
		(device) =>
			device.ownerName ?? device.ownerEmail ?? device.username ?? "Unassigned",
		{
			id: "user",
			header: "User",
			cell: ({ row }) => (
				<div>
					<p>{row.original.ownerName ?? "Unassigned"}</p>
					<p className="text-[10px] text-muted-foreground">
						{row.original.ownerEmail ??
							row.original.username ??
							"No user details"}
					</p>
				</div>
			),
		},
	),
	column.accessor(
		(device) => `${device.platform ?? "Unknown"} ${device.release ?? ""}`,
		{
			id: "platform",
			header: "Platform",
			cell: ({ row }) => (
				<div>
					<p>
						{row.original.platform ?? "Unknown"} {row.original.release ?? ""}
					</p>
					<p className="text-[10px] text-muted-foreground">
						Agent {row.original.agentVersion ?? "unknown"}
					</p>
				</div>
			),
		},
	),
	column.accessor("lastCommand", {
		header: "Last command",
		cell: ({ getValue }) => {
			const command = getValue();
			return command ? (
				<div>
					<p className="font-mono">{command.tool}</p>
					<Badge variant="outline">{command.status}</Badge>
				</div>
			) : (
				"—"
			);
		},
	}),
	column.accessor("lastSeenAt", {
		header: "Last seen",
		cell: ({ getValue }) => {
			const value = getValue();
			return (
				<span className="tabular-nums" title={value.toLocaleString()}>
					{timeAgo(value)}
				</span>
			);
		},
		sortingFn: "datetime",
	}),
];

export function DevicesTable({
	deviceId,
	onSelectDevice,
}: {
	deviceId?: string;
	onSelectDevice: (deviceId?: string) => void;
}) {
	const query = useQuery(
		orpc.listDevices.queryOptions({
			refetchInterval: 5_000,
			refetchIntervalInBackground: false,
		}),
	);
	const selected = query.data?.find((device) => device.id === deviceId) ?? null;
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

	if (query.isPending && query.data == null)
		return (
			<PageState
				kind="loading"
				title="Loading devices"
				description="Reading endpoint activity…"
			/>
		);
	if (query.isError && query.data == null)
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
					placeholder="Filter hostname, user, or platform…"
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
				<div className="border bg-card">
					<Table>
						<TableHeader>
							{table.getHeaderGroups().map((group) => (
								<TableRow key={group.id}>
									{group.headers.map((header) => (
										<TableHead key={header.id}>
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
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									tabIndex={0}
									className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									onClick={() => onSelectDevice(row.original.id)}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											onSelectDevice(row.original.id);
										}
									}}
									aria-label={`View ${row.original.hostname} device details`}
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
				</div>
			)}
			<div className="flex items-center justify-between text-muted-foreground text-xs">
				<span className="tabular-nums">
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
			<DeviceDetailSheet
				device={selected}
				onOpenChange={(open) => !open && onSelectDevice()}
			/>
		</div>
	);
}
