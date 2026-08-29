import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { Route } from "@/routes/_auth/tickets.index";
import { ticketMutations } from "../api/mutations";
import { ticketQueries } from "../api/queries";
import type { TicketListInput, UpdateTicketInput } from "../api/types";
import { type TicketQueueSearch, toTicketListInput } from "./queue-search";
import { TicketQueue } from "./ticket-queue";

export function TicketQueuePage() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const queryClient = useQueryClient();
	const query = useQuery(ticketQueries.list(toTicketListInput(search)));
	const mutation = useMutation(
		ticketMutations.update(queryClient, {
			onSuccess: () => toast.success("Ticket updated"),
			onError: (error) => toast.error(error.message),
		}),
	);
	const updateSearch = useCallback(
		(patch: Partial<TicketQueueSearch>, replace = false) =>
			void navigate({
				search: (previous) => ({
					...previous,
					...patch,
					cursor: "cursor" in patch ? patch.cursor : undefined,
					cursorHistory: "cursor" in patch ? patch.cursorHistory : undefined,
				}),
				replace,
			}),
		[navigate],
	);
	const replaceView = (next: TicketQueueSearch) =>
		void navigate({
			search: { ...next, density: search.density },
		});
	const updateSort = (
		sortBy: TicketListInput["sortBy"],
		sortDirection: TicketListInput["sortDirection"],
	) => updateSearch({ sortBy, sortDirection });
	const runShortcutAction = (input: UpdateTicketInput) =>
		mutation.mutate(input);

	return (
		<PageContainer
			title="Ticket queue"
			description="Live service desk requests and Axel’s progress."
		>
			<TicketQueue
				result={query.data}
				search={search}
				isPending={query.isPending}
				isFetching={query.isFetching}
				error={query.error}
				onRetry={() => query.refetch()}
				onSearchChange={updateSearch}
				onViewSelect={replaceView}
				onSortChange={updateSort}
				onShortcutAction={runShortcutAction}
				onPrevious={() => {
					const history = search.cursorHistory ?? [];
					updateSearch({
						cursor: history.at(-1),
						cursorHistory: history.slice(0, -1),
					});
				}}
				onNext={() => {
					if (!query.data?.nextCursor) return;
					updateSearch({
						cursor: query.data.nextCursor,
						cursorHistory: search.cursor
							? [...(search.cursorHistory ?? []), search.cursor]
							: search.cursorHistory,
					});
				}}
				onReset={() => void navigate({ search: {} })}
			/>
		</PageContainer>
	);
}
