import type { ColumnDef } from "@tanstack/react-table";
import { Laptop, Siren, Wrench } from "lucide-react";
import { StatusBadge, timeAgo } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import type { Ticket } from "../api/types";

const priorityTone = {
	P1: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
	P2: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
	P3: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
	P4: "border-border bg-muted text-muted-foreground",
};

export const queueColumns: ColumnDef<Ticket>[] = [
	{
		accessorKey: "priority",
		header: "Priority",
		cell: ({ row }) => (
			<Badge variant="outline" className={priorityTone[row.original.priority]}>
				{row.original.priority}
			</Badge>
		),
	},
	{
		accessorKey: "status",
		header: "Status",
		cell: ({ row }) => (
			<div className="flex items-center gap-2">
				<StatusBadge
					status={row.original.status}
					label={row.original.statusLabel}
					stateType={row.original.statusStateType}
				/>
				{row.original.escalationFlag !== "none" ? (
					<Badge
						variant="destructive"
						title={row.original.escalationReason ?? undefined}
					>
						{row.original.escalationFlag}
					</Badge>
				) : null}
			</div>
		),
	},
	{
		accessorKey: "recordType",
		header: () => <span className="sr-only">Record type</span>,
		cell: ({ row }) =>
			row.original.recordType === "incident" ? (
				<Siren aria-label="Incident" className="size-4 text-orange-600" />
			) : (
				<Wrench aria-label="Service request" className="size-4" />
			),
	},
	{
		accessorKey: "title",
		header: "Ticket",
		cell: ({ row }) => (
			<div className="max-w-80 whitespace-normal">
				<div className="font-medium text-foreground">{row.original.title}</div>
				<div className="font-mono text-[10px] text-muted-foreground">
					{row.original.number ?? row.original.id}
				</div>
			</div>
		),
	},
	{ accessorKey: "reporterName", header: "Reporter" },
	{
		accessorKey: "impact",
		header: "Impact",
		cell: ({ row }) => (
			<span className="capitalize">{row.original.impact}</span>
		),
	},
	{
		accessorKey: "urgency",
		header: "Urgency",
		cell: ({ row }) => (
			<span className="capitalize">{row.original.urgency}</span>
		),
	},
	{
		id: "service",
		header: "Service",
		cell: ({ row }) => (
			<span>
				{row.original.serviceName} / {row.original.serviceSubcategoryName}
			</span>
		),
	},
	{
		accessorKey: "route",
		header: "Route",
		cell: ({ row }) => row.original.route?.replaceAll("_", " ") ?? "Unassigned",
	},
	{
		accessorKey: "assigneeName",
		header: "Assignee",
		cell: ({ row }) => row.original.assigneeName ?? "Unassigned",
	},
	{
		accessorKey: "teamName",
		header: "Team",
		cell: ({ row }) => row.original.teamName ?? "Unassigned",
	},
	{
		accessorKey: "deviceId",
		header: () => <span className="sr-only">Device</span>,
		cell: ({ row }) =>
			row.original.deviceId ? (
				<Laptop aria-label="Linked device" className="size-4" />
			) : null,
	},
	{
		accessorKey: "updatedAt",
		header: "Updated",
		cell: ({ row }) => (
			<time
				className="tabular-nums"
				dateTime={row.original.updatedAt.toISOString()}
				title={row.original.updatedAt.toLocaleString()}
			>
				{timeAgo(row.original.updatedAt)}
			</time>
		),
	},
];
