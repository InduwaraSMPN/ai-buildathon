import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { orpc } from "@/utils/orpc";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

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
				<Bell />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80 p-2">
				<DropdownMenuLabel>
					Notifications {query.data && unread ? `(${unread})` : ""}
				</DropdownMenuLabel>
				{query.isPending && query.data == null ? (
					<p className="p-2 text-muted-foreground text-xs" role="status">
						Loading notifications…
					</p>
				) : query.isError && query.data == null ? (
					<div className="p-2" role="alert">
						<p className="text-destructive text-xs">
							Could not load notifications
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							{query.error.message}
						</p>
						<Button
							variant="outline"
							size="sm"
							className="mt-2"
							onClick={() => query.refetch()}
						>
							Try again
						</Button>
					</div>
				) : query.data?.length === 0 ? (
					<p className="p-2 text-muted-foreground text-xs">
						You’re all caught up.
					</p>
				) : null}
				{query.data?.map((item) => (
					<Link
						key={item.id}
						to={item.recordType === "ticket" ? "/tickets/$ticketId" : "/home"}
						params={
							item.recordType === "ticket"
								? { ticketId: item.recordId }
								: undefined
						}
						className="block border-t p-2 text-xs"
						onClick={() => !item.readAt && markRead.mutate({ id: item.id })}
					>
						<p className="font-medium">
							{item.title}
							{item.eventCount > 1 ? ` (${item.eventCount})` : ""}
						</p>
						<p className="line-clamp-2 text-muted-foreground">{item.body}</p>
					</Link>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
