import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { orpc } from "@/utils/orpc";
import {
	normalizeTicketQueueSearch,
	type TicketQueueSearch,
} from "./queue-search";

const clean = (search: TicketQueueSearch): TicketQueueSearch =>
	Object.fromEntries(
		Object.entries(search).filter(
			([key, value]) =>
				!key.startsWith("cursor") && key !== "density" && value !== undefined,
		),
	) as TicketQueueSearch;

const savedSearch = (value: unknown) =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? normalizeTicketQueueSearch(value as Record<string, unknown>)
		: {};

export function SavedViews({
	active,
	onSelect,
}: {
	active: TicketQueueSearch;
	onSelect: (search: TicketQueueSearch) => void;
}) {
	const queryClient = useQueryClient();
	const views = useQuery(orpc.listSavedViews.queryOptions());
	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: orpc.listSavedViews.key() });
	const create = useMutation(
		orpc.createSavedView.mutationOptions({ onSuccess: invalidate }),
	);
	const remove = useMutation(
		orpc.deleteSavedView.mutationOptions({ onSuccess: invalidate }),
	);
	const save = () => {
		const name = window.prompt("View name")?.trim();
		if (!name) return;
		create.mutate(
			{ name, objectType: "ticket", filters: clean(active) },
			{ onSuccess: () => toast.success("View saved") },
		);
	};

	return (
		<nav
			aria-label="Saved queue views"
			className="flex flex-wrap items-center gap-1.5"
		>
			{views.data
				?.filter((view) => !view.objectType || view.objectType === "ticket")
				.map((view) => (
					<div key={view.id} className="flex items-center">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onSelect(savedSearch(view.filters))}
						>
							{view.name}
						</Button>
						{view.ownerType === "user" ? (
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={`Delete ${view.name}`}
								onClick={() => remove.mutate({ id: view.id })}
							>
								<Trash2 />
							</Button>
						) : null}
					</div>
				))}
			<Button
				variant="outline"
				size="sm"
				onClick={save}
				disabled={create.isPending}
			>
				<Plus /> Save view
			</Button>
		</nav>
	);
}
