import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { PageState, timeAgo } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import { orpc } from "@/utils/orpc";
import type { Device } from "../api/types";
import { DeviceDetailSheet } from "./device-detail-sheet";

const column = createColumnHelper<Device>();
const columns = [
	column.accessor("hostname", {
		header: "Device",
		size: 22,
		cell: ({ row }) => {
			const online =
				!row.original.revokedAt &&
				Date.now() - row.original.lastSeenAt.getTime() <= 30_000;
			return (
				<div>
					<p className="flex items-center gap-2 font-medium">
						<span
							className={`size-2 rounded-full ${online ? "bg-success" : "bg-muted-foreground/50"}`}
							aria-hidden="true"
						/>
						{row.original.hostname}
						<span className="sr-only">
							{row.original.revokedAt
								? "Revoked"
								: online
									? "Online"
									: "Offline"}
						</span>
					</p>
					<p className="font-mono text-muted-foreground text-xs">
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
			size: 20,
			cell: ({ row }) => (
				<div>
					<p>{row.original.ownerName ?? "Unassigned"}</p>
					<p className="text-muted-foreground text-xs">
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
			size: 18,
			cell: ({ row }) => (
				<div>
					<p>
						{row.original.platform ?? "Unknown"} {row.original.release ?? ""}
					</p>
					<p className="text-muted-foreground text-xs">
						Agent {row.original.agentVersion ?? "unknown"}
					</p>
				</div>
			),
		},
	),
	column.accessor("lastCommand", {
		header: "Last command",
		size: 16,
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
	column.accessor("credentialStatus", {
		header: "Credential",
		size: 12,
		cell: ({ row, getValue }) => (
			<Badge variant={row.original.revokedAt ? "destructive" : "outline"}>
				{getValue()}
			</Badge>
		),
	}),
	column.accessor("lastSeenAt", {
		header: "Last seen",
		size: 12,
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
		<>
			<DataTable
				data={query.data ?? []}
				columns={columns}
				filterLabel="Filter devices"
				filterPlaceholder="Filter hostname, user, or platform…"
				emptyTitle="No devices found"
				emptyDescription="No devices are enrolled."
				onRowClick={(device) => onSelectDevice(device.id)}
				rowLabel={(device) => `View ${device.hostname} device details`}
			/>
			<DeviceDetailSheet
				device={selected}
				onOpenChange={(open) => !open && onSelectDevice()}
			/>
		</>
	);
}
