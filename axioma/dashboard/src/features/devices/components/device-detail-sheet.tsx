import {
	RiExternalLinkLine as ExternalLink,
	RiRefreshLine as RefreshCw,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { formatDate, PageState } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";
import type { Device, DeviceCommand } from "../api/types";

export function DeviceDetailSheet({
	device,
	onOpenChange,
}: {
	device: Device | null;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Sheet open={device !== null} onOpenChange={onOpenChange}>
			{device && <DeviceDetail device={device} />}
		</Sheet>
	);
}

function DeviceDetail({ device }: { device: Device }) {
	const commands = useQuery(
		orpc.listDeviceCommands.queryOptions({
			input: { deviceId: device.id, limit: 20 },
			refetchInterval: 5_000,
			refetchIntervalInBackground: false,
		}),
	);
	const inventory = useQuery(
		orpc.readDeviceInventory.queryOptions({
			input: { deviceId: device.id },
		}),
	);
	const online = Date.now() - device.lastSeenAt.getTime() <= 30_000;

	return (
		<SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
			<SheetHeader className="border-b pr-12">
				<div className="flex items-center gap-2">
					<span
						className={`size-2 rounded-full ${online ? "bg-success" : "bg-muted-foreground/50"}`}
						aria-hidden="true"
					/>
					<SheetTitle>{device.hostname}</SheetTitle>
					<Badge variant="outline">{online ? "Online" : "Offline"}</Badge>
				</div>
				<SheetDescription>
					Device details and the latest 20 commands. Online requires activity
					within 30 seconds.
				</SheetDescription>
			</SheetHeader>

			<div className="space-y-6 p-4">
				<dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
					<Detail label="Device ID" value={device.id} mono />
					<Detail label="Owner" value={device.ownerName} />
					<Detail label="Owner email" value={device.ownerEmail} />
					<Detail label="Owner ID" value={device.ownerId} mono />
					<Detail label="Local user" value={device.username} />
					<Detail label="Platform" value={device.platform} />
					<Detail label="Release" value={device.release} />
					<Detail label="Agent version" value={device.agentVersion} />
					<Detail
						label="Last seen"
						value={formatDate(device.lastSeenAt)}
						tabular
					/>
					<Detail
						label="Enrolled"
						value={device.enrolledAt ? formatDate(device.enrolledAt) : null}
						tabular
					/>
					<Detail
						label="Last command ID"
						value={device.lastCommand?.id ?? null}
						mono
					/>
					<Detail
						label="Last command tool"
						value={device.lastCommand?.tool ?? null}
					/>
					<Detail
						label="Last command status"
						value={device.lastCommand?.status ?? null}
					/>
					<Detail
						label="Last command created"
						value={
							device.lastCommand
								? formatDate(device.lastCommand.createdAt)
								: null
						}
						tabular
					/>
					<Detail
						label="Last command completed"
						value={
							device.lastCommand?.completedAt
								? formatDate(device.lastCommand.completedAt)
								: null
						}
						tabular
					/>
				</dl>

				<section
					className="space-y-3"
					aria-labelledby="device-inventory-heading"
				>
					<h2 id="device-inventory-heading" className="font-semibold text-sm">
						Inventory
					</h2>
					{inventory.data ? (
						<>
							<p className="text-muted-foreground text-xs">
								Last reported:{" "}
								{inventory.data.reportedAt?.toLocaleString() ?? "Never"}
							</p>
							<div className="grid gap-3 sm:grid-cols-2">
								<div>
									<h3 className="font-medium text-sm">Hardware</h3>
									<p className="text-sm">
										{inventory.data.hardware?.model ??
											inventory.data.hardware?.manufacturer ??
											"No hardware report"}
									</p>
								</div>
								<div>
									<h3 className="font-medium text-sm">Disks</h3>
									<p className="text-sm">
										{inventory.data.disks.length} reported
									</p>
								</div>
							</div>
							<div>
								<h3 className="font-medium text-sm">Software</h3>
								<p className="text-sm">
									{inventory.data.software.length} installed applications
								</p>
							</div>
						</>
					) : inventory.isPending ? (
						<PageState
							kind="loading"
							title="Loading inventory"
							description="Reading the latest device inventory…"
						/>
					) : inventory.isError ? (
						<PageState
							kind="error"
							title="Inventory unavailable"
							description={inventory.error.message}
							onRetry={() => inventory.refetch()}
						/>
					) : null}
				</section>

				<a
					href={`/tickets/?deviceId=${encodeURIComponent(device.id)}`}
					className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
				>
					View this device in ticket queue
					<ExternalLink className="size-3" aria-hidden="true" />
				</a>

				<section
					aria-labelledby="device-commands-heading"
					className="space-y-3"
				>
					<div className="flex items-center justify-between gap-3">
						<h2 id="device-commands-heading" className="font-semibold text-sm">
							Latest commands
						</h2>
						<span
							className="flex items-center gap-1 text-muted-foreground"
							aria-live="polite"
						>
							<RefreshCw
								className={`size-3 ${commands.isFetching ? "animate-spin" : ""}`}
								aria-hidden="true"
							/>
							{commands.isFetching
								? "Refreshing…"
								: "Refreshes every 5 seconds"}
						</span>
					</div>
					{commands.isPending && commands.data == null ? (
						<PageState
							kind="loading"
							title="Loading commands"
							description="Reading device command history…"
						/>
					) : commands.isError && commands.data == null ? (
						<PageState
							kind="error"
							title="Commands unavailable"
							description={commands.error.message}
							onRetry={() => commands.refetch()}
						/>
					) : commands.data.length === 0 ? (
						<PageState
							kind="empty"
							title="No commands"
							description="This device has no command history."
						/>
					) : (
						<div className="border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Sequence</TableHead>
										<TableHead>Tool / action</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Duration</TableHead>
										<TableHead>Output / error</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{commands.data.map((command) => (
										<CommandRow key={command.id} command={command} />
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</section>
			</div>
		</SheetContent>
	);
}

function Detail({
	label,
	value,
	mono = false,
	tabular = false,
}: {
	label: string;
	value: string | null;
	mono?: boolean;
	tabular?: boolean;
}) {
	return (
		<div>
			<dt className="text-[10px] text-muted-foreground uppercase tracking-wider">
				{label}
			</dt>
			<dd
				className={`${mono ? "break-all font-mono" : "break-words"} ${tabular ? "tabular-nums" : ""}`}
			>
				{value ?? "—"}
			</dd>
		</div>
	);
}

function CommandRow({ command }: { command: DeviceCommand }) {
	const duration = command.completedAt
		? Math.max(
				0,
				command.completedAt.getTime() -
					(command.dispatchedAt ?? command.createdAt).getTime(),
			)
		: null;
	return (
		<TableRow>
			<TableCell className="tabular-nums">{command.sequence}</TableCell>
			<TableCell className="font-mono">
				{command.tool}
				{commandAction(command.input) && (
					<span className="block text-[10px] text-muted-foreground">
						{commandAction(command.input)}
					</span>
				)}
			</TableCell>
			<TableCell>
				<Badge
					variant={
						command.status === "failed" || command.status === "timed_out"
							? "destructive"
							: "outline"
					}
				>
					{command.status}
				</Badge>
			</TableCell>
			<TableCell className="tabular-nums">
				{duration === null
					? "—"
					: duration < 1_000
						? `${duration}ms`
						: `${(duration / 1_000).toFixed(1)}s`}
			</TableCell>
			<TableCell
				className={`max-w-xs whitespace-pre-wrap ${command.error ? "text-destructive" : "font-mono"}`}
			>
				{command.error ?? serialize(command.output)}
			</TableCell>
		</TableRow>
	);
}

function commandAction(input: unknown) {
	if (!input || typeof input !== "object" || !("action" in input)) return null;
	return typeof input.action === "string" ? input.action : null;
}

function serialize(value: unknown) {
	if (value == null) return "—";
	if (typeof value === "string") return value;
	return JSON.stringify(value, null, 2) ?? String(value);
}
