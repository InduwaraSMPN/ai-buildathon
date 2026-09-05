import { RiAddLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
	ErrorState,
	PageHeading,
	PageShell,
	panelCardClass,
	panelTitleClass,
} from "@/components/ticket-ui";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DeviceClaimForm } from "@/features/devices/components/device-claim-form";
import { DeviceList } from "@/features/devices/components/device-list";
import { deviceCopy } from "@/features/devices/copy";
import { NeedsYouCard } from "@/features/home/components/needs-you-card";
import { RequestListCard } from "@/features/home/components/request-list-card";
import { homeCopy } from "@/features/home/copy";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

const pageDate = new Intl.DateTimeFormat(undefined, {
	weekday: "long",
	day: "numeric",
	month: "long",
});

export function HomePage({ name }: { name?: string | null }) {
	const [claimOpen, setClaimOpen] = useState(false);
	const tickets = useQuery(
		orpc.listTickets.queryOptions({
			input: {
				scope: "mine",
				sortBy: "updatedAt",
				sortDirection: "desc",
				limit: 20,
			},
		}),
	);
	const frontDoor = useQuery(orpc.portalIsFrontDoor.queryOptions({}));
	const items = tickets.data?.items ?? [];
	const needsYou = items.filter((ticket) =>
		["pending", "resolved"].includes(ticket.statusStateType),
	);
	const moving = items.filter((ticket) =>
		["new", "open"].includes(ticket.statusStateType),
	).length;
	const canCreate = frontDoor.data?.foreign === false;
	const firstName = name?.trim().split(/\s+/)[0];

	return (
		<PageShell>
			<PageHeading
				title={
					firstName ? homeCopy.greeting(firstName) : homeCopy.fallbackGreeting
				}
				description={
					tickets.data ? homeCopy.summary(needsYou.length, moving) : undefined
				}
				action={
					<time className="text-muted-foreground text-sm">
						{pageDate.format(new Date())}
					</time>
				}
			/>

			{tickets.isPending ? (
				<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-5">
					<Skeleton className="h-[38rem] rounded-3xl" />
					<Skeleton className="h-[38rem] rounded-3xl" />
					<Skeleton className="h-56 rounded-3xl lg:col-span-2" />
				</div>
			) : tickets.isError ? (
				<ErrorState retry={() => tickets.refetch()} error={tickets.error} />
			) : (
				<div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-5">
					<RequestListCard
						tickets={items}
						truncated={tickets.data?.nextCursor != null}
						canCreate={canCreate}
					/>
					<NeedsYouCard tickets={needsYou} />
					{/* Full width on its own row: stacked under Needs you it made the
					    right column outrun the request list, which then stretched to
					    match and left a gap above its footer link. */}
					<Card className={cn(panelCardClass, "lg:col-span-2")}>
						<CardHeader>
							<CardTitle className={panelTitleClass}>
								<h2>{deviceCopy.heading}</h2>
							</CardTitle>
							<CardAction>
								<Button variant="outline" onClick={() => setClaimOpen(true)}>
									<RiAddLine data-icon="inline-start" aria-hidden="true" />
									{deviceCopy.connectComputer}
								</Button>
							</CardAction>
						</CardHeader>
						<CardContent>
							<DeviceList />
						</CardContent>
					</Card>
				</div>
			)}

			<Dialog open={claimOpen} onOpenChange={setClaimOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{deviceCopy.connectComputer}</DialogTitle>
						<DialogDescription>
							{deviceCopy.connectDescription}
						</DialogDescription>
					</DialogHeader>
					<DeviceClaimForm onSuccess={() => setClaimOpen(false)} />
				</DialogContent>
			</Dialog>
		</PageShell>
	);
}
