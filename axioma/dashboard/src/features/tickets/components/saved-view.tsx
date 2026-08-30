import { RiAddLine as Plus, RiDeleteBinLine as Trash2 } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
	const [saveOpen, setSaveOpen] = useState(false);
	const [name, setName] = useState("");
	const views = useQuery(orpc.listSavedViews.queryOptions());
	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: orpc.listSavedViews.key() });
	const create = useMutation(
		orpc.createSavedView.mutationOptions({ onSuccess: invalidate }),
	);
	const remove = useMutation(
		orpc.deleteSavedView.mutationOptions({ onSuccess: invalidate }),
	);
	const ticketViews =
		views.data?.filter(
			(view) => !view.objectType || view.objectType === "ticket",
		) ?? [];
	const save = () => {
		const viewName = name.trim();
		if (!viewName) return;
		create.mutate(
			{ name: viewName, objectType: "ticket", filters: clean(active) },
			{
				onSuccess: () => {
					toast.success("View saved");
					setSaveOpen(false);
					setName("");
				},
			},
		);
	};

	if (views.isPending && views.data == null) {
		return (
			<nav
				aria-label="Saved queue views"
				className="flex flex-wrap items-center gap-1.5"
			>
				<p className="text-muted-foreground text-xs" role="status">
					Loading saved views…
				</p>
			</nav>
		);
	}
	if (views.isError && views.data == null) {
		return (
			<nav
				aria-label="Saved queue views"
				className="flex flex-wrap items-center gap-1.5"
				role="alert"
			>
				<span className="text-destructive text-xs">
					Could not load saved views.
				</span>
				<span className="text-muted-foreground text-xs">
					{views.error.message}
				</span>
				<Button variant="outline" size="sm" onClick={() => views.refetch()}>
					Try again
				</Button>
			</nav>
		);
	}

	return (
		<nav
			aria-label="Saved queue views"
			className="flex flex-wrap items-center gap-1.5"
		>
			{ticketViews.length === 0 ? (
				<p className="text-muted-foreground text-xs">No saved views.</p>
			) : (
				ticketViews.map((view) => (
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
				))
			)}
			<Button
				variant="outline"
				size="sm"
				onClick={() => setSaveOpen(true)}
				disabled={create.isPending}
			>
				<Plus data-icon="inline-start" /> Save view
			</Button>
			<Dialog
				open={saveOpen}
				onOpenChange={(open) => {
					setSaveOpen(open);
					if (!open && !create.isPending) setName("");
				}}
			>
				<DialogContent>
					<form
						className="contents"
						onSubmit={(event) => {
							event.preventDefault();
							save();
						}}
					>
						<DialogHeader>
							<DialogTitle>Save queue view</DialogTitle>
							<DialogDescription>
								Name the current queue filters so you can return to them later.
							</DialogDescription>
						</DialogHeader>
						<Field>
							<FieldLabel htmlFor="saved-view-name">View name</FieldLabel>
							<Input
								id="saved-view-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								autoFocus
							/>
						</Field>
						<DialogFooter>
							<DialogClose render={<Button variant="outline" type="button" />}>
								Cancel
							</DialogClose>
							<Button type="submit" disabled={!name.trim() || create.isPending}>
								Save view
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</nav>
	);
}
