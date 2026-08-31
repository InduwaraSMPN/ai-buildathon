import { RiNotificationLine } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { orpc } from "@/utils/orpc";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Empty, EmptyDescription } from "./ui/empty";
import { Skeleton } from "./ui/skeleton";

export function NotificationCenter() {
	const queryClient = useQueryClient();
	const query = useQuery({
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
	const unread = query.data?.filter((item) => !item.readAt).length ?? 0;
	const unreadLabel =
		query.isPending && query.data == null
			? "Loading notifications"
			: query.isError && query.data == null
				? "Notifications unavailable"
				: `${unread} unread notifications`;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button variant="ghost" size="icon" aria-label={unreadLabel} />}
			>
				<RiNotificationLine />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80 p-2">
				<DropdownMenuLabel>
					Notifications {query.data && unread ? `(${unread})` : ""}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{query.isPending && query.data == null ? (
					<div className="flex flex-col gap-2 p-2" role="status">
						<Skeleton className="h-4 w-2/3" />
						<Skeleton className="h-3 w-full" />
					</div>
				) : query.isError && query.data == null ? (
					<Alert variant="destructive">
						<AlertTitle>Could not load notifications</AlertTitle>
						<AlertDescription>{query.error.message}</AlertDescription>
						<Button variant="outline" size="sm" onClick={() => query.refetch()}>
							Try again
						</Button>
					</Alert>
				) : query.data?.length === 0 ? (
					<Empty className="p-3">
						<EmptyDescription>You’re all caught up.</EmptyDescription>
					</Empty>
				) : null}
				<DropdownMenuGroup>
					{query.data?.map((item) => {
						const isTicket = item.recordType === "ticket";
						return (
							<DropdownMenuItem
								key={item.id}
								render={
									<Link
										to={isTicket ? "/tickets/$ticketId" : "/my-requests"}
										params={isTicket ? { ticketId: item.recordId } : undefined}
									/>
								}
								className="flex-col items-start"
								onClick={() => !item.readAt && markRead.mutate({ id: item.id })}
							>
								<p className="font-medium">
									{item.title}
									{item.eventCount > 1 ? ` (${item.eventCount})` : ""}
								</p>
								<p className="line-clamp-2 text-muted-foreground text-xs">
									{item.body}
								</p>
							</DropdownMenuItem>
						);
					})}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
