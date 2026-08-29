import { useNavigate } from "@tanstack/react-router";
import {
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import {
	ArrowDown,
	ArrowUp,
	Copy,
	ExternalLink,
	MoreHorizontal,
	Search,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	KeyboardShortcutSheet,
	useKeyboardShortcuts,
} from "@/components/keyboard-shortcuts";
import { PageState } from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
	Ticket,
	TicketListInput,
	TicketListResult,
	UpdateTicketInput,
} from "../api/types";
import { allowedActions } from "./allowed-actions";
import { queueColumns } from "./queue-columns";
import { QueueFacet } from "./queue-facet";
import type { TicketQueueSearch } from "./queue-search";
import { SavedViews } from "./saved-view";

export function TicketQueue({
	result,
	search,
	capabilities,
	isPending,
	isFetching,
	error,
	onRetry,
	onSearchChange,
	onViewSelect,
	onSortChange,
	onShortcutAction,
	onPrevious,
	onNext,
	onReset,
}: {
	result?: TicketListResult;
	search: TicketQueueSearch;
	capabilities: readonly string[];
	isPending: boolean;
	isFetching: boolean;
	error: Error | null;
	onRetry: () => void;
	onSearchChange: (
		patch: Partial<TicketQueueSearch>,
		replace?: boolean,
	) => void;
	onViewSelect: (search: TicketQueueSearch) => void;
	onSortChange: (
		sortBy: TicketListInput["sortBy"],
		direction: TicketListInput["sortDirection"],
	) => void;
	onShortcutAction: (input: UpdateTicketInput) => void;
	onPrevious: () => void;
	onNext: () => void;
	onReset: () => void;
}) {
	const navigate = useNavigate();
	const tickets = result?.items ?? [];
	const [selected, setSelected] = useState(-1);
	const [query, setQuery] = useState(search.search ?? "");
	const searchRef = useRef<HTMLInputElement>(null);
	useEffect(() => setQuery(search.search ?? ""), [search.search]);
	useEffect(() => {
		const timer = window.setTimeout(() => {
			if (query.trim() !== (search.search ?? ""))
				onSearchChange({ search: query.trim() || undefined }, true);
		}, 300);
		return () => window.clearTimeout(timer);
	}, [query, search.search, onSearchChange]);
	useEffect(
		() =>
			setSelected((index) =>
				tickets.length === 0
					? -1
					: Math.max(0, Math.min(index, tickets.length - 1)),
			),
		[tickets.length],
	);
	useEffect(() => {
		if (selected < 0) return;
		const row = document.querySelector<HTMLElement>(
			`[data-queue-row="${selected}"]`,
		);
		row?.scrollIntoView({ block: "nearest" });
		row?.focus({ preventScroll: true });
	}, [selected]);

	const open = (
		ticket: Ticket | undefined,
		action?: "assign" | "reclassify",
	) => {
		if (!ticket) return;
		void navigate({
			to: "/tickets/$ticketId",
			params: { ticketId: ticket.id },
			hash: action ? `operator-${action}` : undefined,
		});
	};
	const shortcutAction = (action: "escalate" | "resolve") => {
		const ticket = tickets[selected];
		if (!ticket || !allowedActions(ticket, capabilities).includes(action))
			return;
		if (action === "resolve") {
			void navigate({
				to: "/tickets/$ticketId",
				params: { ticketId: ticket.id },
				hash: "operator-resolve",
			});
			return;
		}
		const note = window.prompt("Escalation reason")?.trim();
		if (note)
			onShortcutAction({ id: ticket.id, action, note, route: "human_triage" });
	};
	const shortcuts = useKeyboardShortcuts({
		search: () => searchRef.current?.focus(),
		next: () => setSelected((index) => Math.min(index + 1, tickets.length - 1)),
		previous: () => setSelected((index) => Math.max(index - 1, 0)),
		open: () => open(tickets[selected]),
		escalate: () => shortcutAction("escalate"),
		resolve: () => shortcutAction("resolve"),
	});
	const table = useReactTable({
		data: tickets,
		columns: [
			...queueColumns,
			{
				id: "actions",
				header: () => <span className="sr-only">Actions</span>,
				cell: ({ row }) => (
					<RowActions
						ticket={row.original}
						capabilities={capabilities}
						onOpen={open}
					/>
				),
			},
		],
		getCoreRowModel: getCoreRowModel(),
	});
	const direction = search.sortDirection ?? "asc";
	const activeSort = search.sortBy ?? "priority";
	const sort = (sortBy: TicketListInput["sortBy"]) =>
		onSortChange(
			sortBy,
			activeSort === sortBy && direction === "asc" ? "desc" : "asc",
		);
	const density = search.density ?? "compact";

	return (
		<section
			className="overflow-hidden rounded-xl border bg-card shadow-xs"
			aria-labelledby="ticket-queue-heading"
			aria-busy={isFetching}
		>
			<div className="space-y-3 border-b p-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 id="ticket-queue-heading" className="font-semibold">
							Ticket queue
						</h2>
						<p className="text-muted-foreground text-xs">
							Triage, route, and resolve employee requests.
						</p>
					</div>
					<SavedViews active={search} onSelect={onViewSelect} />
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						variant={search.myQueue ? "default" : "outline"}
						size="sm"
						onClick={() =>
							onSearchChange({ myQueue: search.myQueue ? undefined : true })
						}
					>
						My queue
					</Button>
					<label className="relative min-w-56 flex-1" htmlFor="ticket-search">
						<span className="sr-only">Search tickets</span>
						<Search className="absolute top-2 left-2.5 size-3.5 text-muted-foreground" />
						<Input
							ref={searchRef}
							id="ticket-search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search ID, title, or reporter…"
							className="pl-8"
						/>
					</label>
					<QueueFacet
						label="Status"
						value={search.status}
						items={result?.facets.status ?? []}
						onChange={(status) =>
							onSearchChange({ status: status as TicketQueueSearch["status"] })
						}
					/>
					<QueueFacet
						label="Priority"
						value={search.priority}
						items={result?.facets.priority ?? []}
						onChange={(priority) =>
							onSearchChange({
								priority: priority as TicketQueueSearch["priority"],
							})
						}
					/>
					<QueueFacet
						label="Assignee"
						value={search.assigneeId ? [search.assigneeId] : undefined}
						items={(result?.facets.assignee ?? []).map(
							({ id, name, count }) => ({ value: id, label: name, count }),
						)}
						onChange={(assignee) =>
							onSearchChange({ assigneeId: assignee?.[0] ?? undefined })
						}
					/>
					<QueueFacet
						label="Team"
						value={search.teamId ? [search.teamId] : undefined}
						items={(result?.facets.team ?? []).map(({ id, name, count }) => ({
							value: id,
							label: name,
							count,
						}))}
						onChange={(team) =>
							onSearchChange({ teamId: team?.[0] ?? undefined })
						}
					/>
					<QueueFacet
						label="Record type"
						value={search.recordType}
						items={result?.facets.recordType ?? []}
						onChange={(recordType) =>
							onSearchChange({
								recordType: recordType as TicketQueueSearch["recordType"],
							})
						}
					/>
					<QueueFacet
						label="Category"
						value={search.category}
						items={result?.facets.category ?? []}
						onChange={(category) =>
							onSearchChange({
								category: category as TicketQueueSearch["category"],
							})
						}
					/>
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							onSearchChange({
								density: density === "compact" ? "comfortable" : undefined,
							})
						}
					>
						{density === "compact" ? "Comfortable" : "Compact"}
					</Button>
					<Button variant="ghost" size="sm" onClick={onReset}>
						Reset
					</Button>
				</div>
			</div>

			{isPending ? (
				<QueueLoading />
			) : error ? (
				<PageState
					kind="error"
					title="Queue unavailable"
					description={error.message}
					onRetry={onRetry}
				/>
			) : tickets.length === 0 ? (
				<PageState
					kind="empty"
					title="No matching tickets"
					description="Change or reset the filters to widen the queue."
				/>
			) : (
				<div className="max-h-[calc(100vh-20rem)] overflow-auto">
					<table className="w-full min-w-[1100px] border-collapse text-left text-xs">
						<thead className="sticky top-0 z-10 bg-card text-muted-foreground shadow-[0_1px_0_var(--border)]">
							{table.getHeaderGroups().map((group) => (
								<tr key={group.id}>
									{group.headers.map((header) => {
										const sortable = ["priority", "updatedAt"].includes(
											header.column.id,
										);
										return (
											<th
												key={header.id}
												scope="col"
												aria-sort={
													sortable
														? activeSort === header.column.id
															? direction === "asc"
																? "ascending"
																: "descending"
															: "none"
														: undefined
												}
												className="whitespace-nowrap px-3 py-2 font-medium"
											>
												{sortable ? (
													<Button
														variant="ghost"
														size="sm"
														className="-ml-3 h-7"
														onClick={() =>
															sort(header.column.id as "priority" | "updatedAt")
														}
													>
														{flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
														{activeSort === header.column.id ? (
															direction === "asc" ? (
																<ArrowUp />
															) : (
																<ArrowDown />
															)
														) : null}
													</Button>
												) : (
													flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)
												)}
											</th>
										);
									})}
								</tr>
							))}
						</thead>
						<tbody>
							{table.getRowModel().rows.map((row, index) => (
								<tr
									key={row.id}
									data-queue-row={index}
									tabIndex={index === selected ? 0 : -1}
									aria-selected={index === selected}
									data-state={index === selected ? "selected" : undefined}
									className="border-t outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring data-[state=selected]:bg-muted/70"
									onClick={() => setSelected(index)}
									onDoubleClick={() => open(row.original)}
								>
									{row.getVisibleCells().map((cell) => (
										<td
											key={cell.id}
											className={cn(
												"px-3 text-muted-foreground first:text-foreground",
												density === "compact" ? "py-2" : "py-4",
											)}
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-xs">
				<span className="text-muted-foreground tabular-nums">
					{tickets.length} tickets{" "}
					{isFetching && !isPending ? "· Updating…" : ""}
				</span>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={!search.cursor}
						onClick={onPrevious}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!result?.nextCursor}
						onClick={onNext}
					>
						Next
					</Button>
				</div>
			</div>
			<KeyboardShortcutSheet
				open={shortcuts.shortcutsOpen}
				onOpenChange={shortcuts.setShortcutsOpen}
			/>
		</section>
	);
}

function RowActions({
	ticket,
	capabilities,
	onOpen,
}: {
	ticket: Ticket;
	capabilities: readonly string[];
	onOpen: (ticket: Ticket, action?: "assign" | "reclassify") => void;
}) {
	const actions = allowedActions(ticket, capabilities);
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={`Actions for ${ticket.id}`}
					/>
				}
			>
				<MoreHorizontal />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuLabel>{ticket.id}</DropdownMenuLabel>
				<DropdownMenuItem onClick={() => onOpen(ticket)}>
					<ExternalLink /> Open
				</DropdownMenuItem>
				{actions.includes("assign") && (
					<DropdownMenuItem onClick={() => onOpen(ticket, "assign")}>
						Assign
					</DropdownMenuItem>
				)}
				{actions.includes("reclassify") && (
					<DropdownMenuItem onClick={() => onOpen(ticket, "reclassify")}>
						Reclassify
					</DropdownMenuItem>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={() => navigator.clipboard.writeText(ticket.id)}
				>
					<Copy /> Copy ID
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function QueueLoading() {
	return (
		<div
			className="space-y-px p-4"
			role="status"
			aria-label="Loading ticket queue"
		>
			{["a", "b", "c", "d", "e", "f", "g", "h"].map((key) => (
				<div key={key} className="h-9 animate-pulse bg-muted/60" />
			))}
		</div>
	);
}
