import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
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
					<span className="absolute top-1 right-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] text-destructive-foreground">
						{unread}
					</span>
				) : null}
			</PopoverTrigger>
			<PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
				<PopoverHeader>
					<PopoverTitle>Notifications</PopoverTitle>
				</PopoverHeader>
				<div className="max-h-96 divide-y overflow-y-auto">
					{notifications.isPending ? <p className="p-3">Loading…</p> : null}
					{notifications.isError ? (
						<p className="p-3 text-destructive">Notifications unavailable.</p>
					) : null}
					{notifications.data?.length === 0 ? (
						<p className="p-3 text-muted-foreground">You’re all caught up.</p>
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
