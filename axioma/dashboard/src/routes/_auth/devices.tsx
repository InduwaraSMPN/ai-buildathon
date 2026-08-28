import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
	PageHeader,
	PageState,
	StatusBadge,
	timeAgo,
} from "@/components/support-ui";
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/devices")({
	component: DeviceList,
});

function DeviceList() {
	const [search, setSearch] = useState("");
	const query = useQuery(orpc.listDevices.queryOptions());
	const devices = useMemo(() => {
		const needle = search.trim().toLowerCase();
		return (query.data ?? []).filter(
			(device) =>
				!needle ||
				`${device.hostname} ${device.ownerName ?? ""} ${device.username ?? ""} ${device.platform ?? ""}`
					.toLowerCase()
					.includes(needle),
		);
	}, [query.data, search]);
	const online = (query.data ?? []).filter(
		(device) => device.connected.toLowerCase() === "connected",
	).length;

	return (
		<div className="mx-auto w-full max-w-[1600px] p-4 lg:p-6">
			<PageHeader
				eyebrow="Fleet / endpoint inventory"
				title="Devices"
				description={`${online} connected · ${(query.data?.length ?? 0) - online} offline`}
				actions={
					<label htmlFor="device-search" className="relative w-72">
						<span className="sr-only">Search devices</span>
						<Search className="absolute top-2 left-2.5 size-3.5 text-muted-foreground" />
						<Input
							id="device-search"
							className="pl-8"
							placeholder="Search device or owner…"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
					</label>
				}
			/>
			<div className="mt-5">
				{query.isPending ? (
					<PageState
						kind="loading"
						title="Loading fleet"
						description="Reading endpoint connection state…"
					/>
				) : query.isError ? (
					<PageState
						kind="error"
						title="Devices unavailable"
						description={query.error.message}
						onRetry={() => query.refetch()}
					/>
				) : devices.length === 0 ? (
					<PageState
						kind="empty"
						title="No devices found"
						description="No enrolled endpoint matches this search."
					/>
				) : (
					<div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
						<table className="w-full min-w-[900px] text-left text-xs">
							<thead className="bg-muted/60 text-[10px] text-muted-foreground uppercase tracking-wider">
								<tr>
									<Th>Endpoint</Th>
									<Th>Connection</Th>
									<Th>Owner</Th>
									<Th>System</Th>
									<Th>Agent</Th>
									<Th>Last seen</Th>
								</tr>
							</thead>
							<tbody>
								{devices.map((device) => (
									<tr key={device.id} className="border-t hover:bg-muted/40">
										<td className="px-3 py-3">
											<div className="flex items-center gap-2">
												<Monitor className="size-4 text-muted-foreground" />
												<div>
													<p className="font-medium">{device.hostname}</p>
													<p className="font-mono text-[10px] text-muted-foreground">
														{device.id}
													</p>
												</div>
											</div>
										</td>
										<td className="px-3 py-3">
											<StatusBadge status={device.connected} />
										</td>
										<td className="px-3 py-3">
											<p>{device.ownerName ?? "Unassigned"}</p>
											<p className="text-[10px] text-muted-foreground">
												{device.username ?? "No local user"}
											</p>
										</td>
										<td className="px-3 py-3">
											<p>{device.platform ?? "Unknown"}</p>
											<p className="text-[10px] text-muted-foreground">
												{device.release ?? "—"}
											</p>
										</td>
										<td className="px-3 py-3 font-mono text-muted-foreground">
											{device.agentVersion ?? "—"}
										</td>
										<td
											className="px-3 py-3 text-muted-foreground"
											title={device.lastSeenAt.toLocaleString()}
										>
											{timeAgo(device.lastSeenAt)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
function Th({ children }: { children: React.ReactNode }) {
	return <th className="px-3 py-2 font-medium">{children}</th>;
}
