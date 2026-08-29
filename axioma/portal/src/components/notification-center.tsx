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
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						size="icon"
						aria-label={`${unread} unread notifications`}
					/>
				}
			>
				<Bell />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80 p-2">
				<DropdownMenuLabel>
					Notifications {unread ? `(${unread})` : ""}
				</DropdownMenuLabel>
				{query.data?.length === 0 ? (
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
