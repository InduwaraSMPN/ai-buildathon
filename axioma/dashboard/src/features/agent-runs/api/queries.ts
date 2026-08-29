import { queryOptions } from "@tanstack/react-query";
import { agentRunsService } from "./service";
import type { AgentRun } from "./types";

export const agentRunKeys = {
	all: ["agent-runs"] as const,
	detail: (id: string) => [...agentRunKeys.all, "detail", id] as const,
};

export const agentRunQueries = {
	detail: (id: string) =>
		queryOptions({
			queryKey: agentRunKeys.detail(id),
			queryFn: () => agentRunsService.get(id),
			refetchInterval: (query) =>
				(query.state.data as AgentRun | null | undefined)?.status ===
					"running" && document.visibilityState === "visible"
					? 2_000
					: false,
		}),
};
