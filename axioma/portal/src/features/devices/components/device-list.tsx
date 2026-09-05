import { RiComputerLine } from "@remixicon/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { timeAgo } from "@/components/ticket-ui";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { deviceCopy } from "@/features/devices/copy";
import { orpc, queryClient } from "@/utils/orpc";

export function DeviceList() {
	const devices = useQuery(orpc.listMyDevices.queryOptions());
	// Releasing is the reverse of claiming, so it invalidates the same list the
	// claim form does. The row disappears on success because the query is scoped
	// to devices this account owns.
	const release = useMutation(
		orpc.releaseMyDevice.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: orpc.listMyDevices.key() }),
		}),
	);

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
		return (
			<>
				<p className="text-muted-foreground text-sm">{deviceCopy.empty}</p>
				{release.isSuccess ? (
					<p className="mt-3 text-sm" role="status">
						{deviceCopy.disconnected}
					</p>
				) : null}
			</>
		);
	}

	return (
		<>
			<ItemGroup className="sm:grid sm:grid-cols-2">
				{devices.data.map((device) => {
					const online = device.connected === "online";
					const releasing =
						release.isPending && release.variables?.deviceId === device.id;
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
							<ItemActions>
								<Badge variant="outline" tone={online ? "success" : "neutral"}>
									{online ? deviceCopy.online : deviceCopy.offline}
								</Badge>
								<AlertDialog>
									<AlertDialogTrigger
										render={<Button variant="ghost" size="sm" />}
									>
										{deviceCopy.disconnect}
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												{deviceCopy.disconnectTitle}
											</AlertDialogTitle>
											<AlertDialogDescription>
												{deviceCopy.disconnectBody}
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>
												{deviceCopy.disconnectCancel}
											</AlertDialogCancel>
											<AlertDialogAction
												disabled={releasing}
												onClick={() => release.mutate({ deviceId: device.id })}
											>
												{releasing ? (
													<Spinner data-icon="inline-start" />
												) : null}
												{releasing
													? deviceCopy.disconnecting
													: deviceCopy.disconnect}
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</ItemActions>
						</Item>
					);
				})}
			</ItemGroup>
			{release.isError ? (
				<FieldError className="mt-3">{deviceCopy.disconnectError}</FieldError>
			) : null}
			{release.isSuccess ? (
				<p className="mt-3 text-sm" role="status">
					{deviceCopy.disconnected}
				</p>
			) : null}
		</>
	);
}
