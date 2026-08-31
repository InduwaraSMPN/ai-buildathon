import { RiNotification3Line as Bell } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/utils/orpc";

export function NotificationCenter() {
	const queryClient = useQueryClient();
	const notifications = useQuery({
		...orpc.listNotifications.queryOptions(),
		refetchInterval: 30_000,
	});
	const markRead = useMutation(
		orpc.markNotificationRead.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: orpc.listNotifications.key(),
				}),
		}),
	);
	const unread = notifications.data?.filter((item) => !item.readAt).length ?? 0;

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						variant="ghost"
						size="icon"
						aria-label={`${unread} unread notifications`}
					/>
				}
			>
				<Bell />
				{unread ? (
					<Badge
						variant="destructive"
						className="absolute top-1 right-1 h-4 min-w-4 px-1 text-xs"
					>
						{unread}
					</Badge>
				) : null}
			</PopoverTrigger>
			<PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
				<PopoverHeader>
					<PopoverTitle>Notifications</PopoverTitle>
				</PopoverHeader>
				<div className="max-h-96 divide-y overflow-y-auto">
					{notifications.isPending ? (
						<div
							className="flex items-center justify-center gap-2 p-6 text-muted-foreground"
							role="status"
						>
							<Spinner />
							Loading…
						</div>
					) : null}
					{notifications.isError ? (
						<Alert variant="destructive" className="m-3 w-auto">
							<AlertDescription>Notifications unavailable.</AlertDescription>
						</Alert>
					) : null}
					{notifications.data?.length === 0 ? (
						<Empty className="p-6">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Bell />
								</EmptyMedia>
								<EmptyTitle>No notifications</EmptyTitle>
								<EmptyDescription>You’re all caught up.</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : null}
					{notifications.data?.map((item) => {
						const content = (
							<div className="min-w-0 flex-1">
								<p className="font-medium text-sm">{item.title}</p>
								<p className="line-clamp-2 text-muted-foreground">
									{item.body}
								</p>
								{item.eventCount > 1 ? (
									<p className="mt-1 text-muted-foreground">
										{item.eventCount} updates
									</p>
								) : null}
							</div>
						);
						return (
							<div key={item.id} className="flex gap-2 p-3">
								{item.recordType === "ticket" ? (
									<Link
										to="/tickets/$ticketId"
										params={{ ticketId: item.recordId }}
										className="min-w-0 flex-1"
										onClick={() =>
											!item.readAt && markRead.mutate({ id: item.id })
										}
									>
										{content}
									</Link>
								) : (
									content
								)}
								{!item.readAt ? (
									<Button
										size="sm"
										variant="ghost"
										onClick={() => markRead.mutate({ id: item.id })}
									>
										Mark read
									</Button>
								) : null}
							</div>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}
