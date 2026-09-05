import { RiComputerLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { timeAgo } from "@/components/ticket-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { deviceCopy } from "@/features/devices/copy";
import { orpc } from "@/utils/orpc";

export function DeviceList() {
	const devices = useQuery(orpc.listMyDevices.queryOptions());

	if (devices.isPending) {
		return (
			<ItemGroup aria-label={deviceCopy.loading}>
				{[0, 1].map((item) => (
					<Item key={item} variant="outline">
						<Skeleton className="size-8" />
						<ItemContent>
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-24" />
						</ItemContent>
					</Item>
				))}
			</ItemGroup>
		);
	}

	if (devices.isError) {
		return (
			<div className="flex flex-wrap items-center gap-3 text-sm" role="alert">
				<span>{deviceCopy.error}</span>
				<Button variant="outline" size="sm" onClick={() => devices.refetch()}>
					{deviceCopy.tryAgain}
				</Button>
			</div>
		);
	}

	if (devices.data.length === 0) {
		return <p className="text-muted-foreground text-sm">{deviceCopy.empty}</p>;
	}

	return (
		<ItemGroup className="sm:grid sm:grid-cols-2">
			{devices.data.map((device) => {
				const online = device.connected === "online";
				return (
					<Item key={device.id} variant="outline" role="listitem">
						<ItemMedia variant="icon">
							<RiComputerLine aria-hidden="true" />
						</ItemMedia>
						<ItemContent>
							<ItemTitle className="font-mono">{device.hostname}</ItemTitle>
							<ItemDescription>
								{deviceCopy.lastSeen} {timeAgo(device.lastSeenAt)}
							</ItemDescription>
						</ItemContent>
						<Badge variant="outline" tone={online ? "success" : "neutral"}>
							{online ? deviceCopy.online : deviceCopy.offline}
						</Badge>
					</Item>
				);
			})}
		</ItemGroup>
	);
}
