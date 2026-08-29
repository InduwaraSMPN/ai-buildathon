import type { client } from "@/utils/orpc";

export type AgentRun = NonNullable<Awaited<ReturnType<typeof client.getRun>>>;
export type AgentRunSummary = Awaited<ReturnType<typeof client.startRun>>;
export type AgentStep = AgentRun["steps"][number];
export type StartRunInput = Parameters<typeof client.startRun>[0];
export type CancelRunInput = Parameters<typeof client.cancelRun>[0];
