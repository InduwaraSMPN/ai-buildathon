import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { Route } from "@/routes/_auth/tickets.index";
import { orpc } from "@/utils/orpc";
import type { TicketListInput, UpdateTicketInput } from "../api/types";
import { invalidateTicketQueries } from "../query-behavior";
import { type TicketQueueSearch, toTicketListInput } from "./queue-search";
import { TicketQueue } from "./ticket-queue";

export function TicketQueuePage() {
	const search = Route.useSearch();
	const { capabilities } = Route.useRouteContext();
	const navigate = useNavigate({ from: Route.fullPath });
	const queryClient = useQueryClient();
	const query = useQuery(
		orpc.listTickets.queryOptions({
			input: toTicketListInput(search),
			refetchInterval: 15_000,
			refetchIntervalInBackground: false,
		}),
	);
	const mutation = useMutation(
		orpc.updateTicket.mutationOptions({
			onSuccess: async (_data, variables) => {
				await invalidateTicketQueries(queryClient, orpc, variables.id);
				toast.success("Ticket updated");
			},
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
				capabilities={capabilities}
				isPending={query.isPending && query.data == null}
				isFetching={query.isFetching}
				error={query.data == null ? query.error : null}
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
