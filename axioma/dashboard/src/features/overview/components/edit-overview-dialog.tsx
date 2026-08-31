import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
	type OverviewWidget,
	WidgetArrangement,
} from "@/features/automation/components";
import { orpc } from "@/utils/orpc";

/**
 * The widgets a user may arrange. Titles live here rather than with the
 * overview's renderers because a saved arrangement only stores a key, and a
 * key that no longer ships still has to render as something readable.
 */
const available = [
	{ key: "priority", title: "Open by priority", width: 2 },
	{ key: "confirmation", title: "Awaiting confirmation", width: 1 },
	{ key: "escalations", title: "Escalated in 24 hours", width: 1 },
	{ key: "resolution-rate", title: "Autonomous resolution rate", width: 1 },
	{ key: "median-ttr", title: "Median time to resolution", width: 1 },
] satisfies OverviewWidget[];

export function EditOverviewDialog() {
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();
	const query = useQuery({
		...orpc.getDashboardArrangement.queryOptions(),
		enabled: open,
	});
	const latestMutation = useRef(0);
	const arrangementQuery = { queryKey: orpc.getDashboardArrangement.key() };
	const save = useMutation(
		orpc.setDashboardArrangement.mutationOptions({
			scope: { id: "dashboard-arrangement" },
			onMutate: async ({ widgets }) => {
				const mutationId = ++latestMutation.current;
				await queryClient.cancelQueries(arrangementQuery);
				queryClient.setQueryData(
					arrangementQuery.queryKey,
					widgets.map((widget, position) => ({ ...widget, position })),
				);
				return { mutationId };
			},
			// Reordering is optimistic and fires per move, so a stale response must
			// never overwrite a newer one: only the most recent mutation may commit.
			onSuccess: (arrangement, _variables, context) => {
				if (context?.mutationId !== latestMutation.current) return;
				queryClient.setQueryData(arrangementQuery.queryKey, arrangement);
			},
			onError: async (error, _variables, context) => {
				if (context?.mutationId !== latestMutation.current) return;
				await queryClient.invalidateQueries(arrangementQuery);
				toast.error(error.message);
			},
		}),
	);
	const saved = query.data;
	const widgets = saved?.length
		? saved.map((entry) => ({
				key: entry.widgetKey,
				title:
					available.find((item) => item.key === entry.widgetKey)?.title ??
					entry.widgetKey,
				width: entry.width,
			}))
		: available;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button size="sm">Edit this view</Button>} />
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Edit this view</DialogTitle>
					<DialogDescription>
						Reorder the widgets shown on your overview. Changes save as you make
						them.
					</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					{query.isPending ? (
						<div
							className="flex items-center justify-center gap-2 p-6 text-muted-foreground text-sm"
							role="status"
						>
							<Spinner />
							Loading widgets…
						</div>
					) : query.isError ? (
						<div className="p-4 text-center text-sm" role="alert">
							<p className="text-destructive">Widgets unavailable</p>
							<p className="mt-1 text-muted-foreground text-xs">
								{query.error.message}
							</p>
							<Button
								variant="outline"
								size="sm"
								className="mt-3"
								onClick={() => query.refetch()}
							>
								Try again
							</Button>
						</div>
					) : (
						<WidgetArrangement
							widgets={widgets}
							onChange={(next) =>
								save.mutate({
									widgets: next.map(({ key, width }) => ({
										widgetKey: key,
										width,
									})),
								})
							}
						/>
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Done
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
